import { lookup as dnsLookup } from 'node:dns/promises';
import { isIP } from 'node:net';

export interface FetchCappedOptions {
  maxBytes: number;
  timeoutMs: number;
  accept?: string;
  /** Replaceable in tests so nothing touches the network. */
  fetchImpl?: typeof fetch;
  /** Replaceable in tests; must return every address of the host. */
  lookupImpl?: (host: string) => Promise<Array<{ address: string }>>;
}

export interface CappedResponse {
  ok: boolean;
  status: number;
  contentType: string;
  finalUrl: string;
  bytes: Uint8Array;
  text(): string;
}

const MAX_REDIRECTS = 3;

function ipv4Blocked(address: string): boolean {
  const parts = address.split('.').map(Number);
  if (parts.length !== 4 || parts.some((p) => !Number.isInteger(p))) return true;
  const [a, b] = parts as [number, number, number, number];
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168)
  );
}

/** True when the literal address is loopback, private, link-local, CGNAT or unspecified. */
export function isBlockedAddress(raw: string): boolean {
  const address = raw.toLowerCase().replace(/^\[|\]$/g, '');
  const family = isIP(address);
  if (family === 4) return ipv4Blocked(address);
  if (family !== 6) return true;
  if (address === '::' || address === '::1') return true;
  const mapped = address.match(/^::ffff:(?:(\d+\.\d+\.\d+\.\d+)|([0-9a-f]{1,4}):([0-9a-f]{1,4}))$/);
  if (mapped) {
    if (mapped[1]) return ipv4Blocked(mapped[1]);
    const hi = Number.parseInt(mapped[2] as string, 16);
    const lo = Number.parseInt(mapped[3] as string, 16);
    return ipv4Blocked(`${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`);
  }
  const first = Number.parseInt(address.split(':')[0] || '0', 16);
  if ((first & 0xfe00) === 0xfc00) return true; // fc00::/7 unique-local
  if ((first & 0xffc0) === 0xfe80) return true; // fe80::/10 link-local
  return false;
}

async function assertPublicHttps(
  rawUrl: string,
  lookupImpl: NonNullable<FetchCappedOptions['lookupImpl']>,
): Promise<URL> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error(`invalid url ${rawUrl}`);
  }
  if (url.protocol !== 'https:') throw new Error(`blocked non-https url ${url.origin}`);
  const host = url.hostname.replace(/^\[|\]$/g, '');
  const addresses = isIP(host) ? [{ address: host }] : await lookupImpl(host);
  if (addresses.length === 0) throw new Error(`host ${host} did not resolve`);
  for (const { address } of addresses) {
    if (isBlockedAddress(address)) throw new Error(`blocked address for host ${host}`);
  }
  return url;
}

async function readCapped(res: Response, maxBytes: number): Promise<Uint8Array> {
  const declared = Number(res.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > maxBytes) {
    await res.body?.cancel().catch(() => undefined);
    throw new Error(`response too large (${declared} > ${maxBytes} bytes)`);
  }
  if (!res.body) return new Uint8Array(0);
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => undefined);
      throw new Error(`response too large (over ${maxBytes} bytes)`);
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

/**
 * GET an https URL with a size cap and a timeout. Every hop (including redirects, followed manually up to 3 times)
 * must be https and resolve only to public addresses. Throws on any violation.
 */
export async function fetchCapped(
  rawUrl: string,
  options: FetchCappedOptions,
): Promise<CappedResponse> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const lookupImpl =
    options.lookupImpl ?? ((host: string) => dnsLookup(host, { all: true, verbatim: true }));
  const signal = AbortSignal.timeout(options.timeoutMs);
  const headers: Record<string, string> = options.accept ? { accept: options.accept } : {};
  let current = rawUrl;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const url = await assertPublicHttps(current, lookupImpl);
    const res = await fetchImpl(url.href, { headers, signal, redirect: 'manual' });
    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get('location');
      await res.body?.cancel().catch(() => undefined);
      if (!location) throw new Error(`redirect ${res.status} without location`);
      current = new URL(location, url).href;
      continue;
    }
    const bytes = res.ok ? await readCapped(res, options.maxBytes) : new Uint8Array(0);
    if (!res.ok) await res.body?.cancel().catch(() => undefined);
    return {
      ok: res.ok,
      status: res.status,
      contentType: res.headers.get('content-type') ?? '',
      finalUrl: url.href,
      bytes,
      text: () => new TextDecoder().decode(bytes),
    };
  }
  throw new Error(`too many redirects (more than ${MAX_REDIRECTS})`);
}
