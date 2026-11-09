/**
 * Parses `TRUST_PROXY` into a value for Fastify's `trustProxy` option.
 *
 * - unset, empty or `false`: `false` (trust no proxy; `req.ip` is the socket address).
 * - a positive integer N: trust N hops (the N proxies closest to the API); `req.ip` is the address the
 *   N-th proxy saw, so a client-supplied `X-Forwarded-For` entry cannot spoof it. Fastify 5 fails
 *   closed on a plain number (it ignores the header), so a hop count becomes a trust function.
 * - a comma-separated list of IPs/CIDRs: trust only those proxies.
 * - legacy `true`: never trust every hop (that lets a client choose its own IP); treated as 1 hop.
 */
/** Fastify's trust function: called per address, `hop` 0 being the socket peer. */
export type TrustProxyFn = (address: string, hop: number) => boolean;
export type TrustProxyValue = false | TrustProxyFn | string[];

function hops(count: number): TrustProxyFn {
  return (_address, hop) => hop < count;
}

export interface TrustProxyResult {
  value: TrustProxyValue;
  /** Set when the raw value is deprecated or invalid; the caller logs it at startup. */
  warning?: string;
}

const IPV4 = /^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?$/;
const IPV6 = /^[0-9a-f:]+(\/\d{1,3})?$/i;

function isAddressOrCidr(entry: string): boolean {
  if (IPV4.test(entry)) {
    const [addr, prefix] = entry.split('/');
    return (
      (addr ?? '').split('.').every((part) => Number(part) <= 255) &&
      (prefix === undefined || Number(prefix) <= 32)
    );
  }
  return entry.includes(':') && IPV6.test(entry);
}

export function parseTrustProxy(raw: string | undefined): TrustProxyResult {
  const text = raw?.trim() ?? '';
  const lower = text.toLowerCase();
  if (!text || lower === 'false') return { value: false };
  if (lower === 'true') {
    return {
      value: hops(1),
      warning:
        'TRUST_PROXY=true is deprecated and no longer trusts every hop; treating it as 1 hop. Set TRUST_PROXY to the number of proxies in front of the API, or to a list of their IPs/CIDRs.',
    };
  }
  if (/^\d+$/.test(text)) {
    const count = Number(text);
    return count > 0 ? { value: hops(count) } : { value: false };
  }
  const entries = text
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
  if (entries.length > 0 && entries.every(isAddressOrCidr)) return { value: entries };
  return {
    value: false,
    warning: `TRUST_PROXY="${text}" is not a hop count or a list of IPs/CIDRs; trusting no proxy.`,
  };
}
