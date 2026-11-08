import type { FeedItem } from './feed';

/** A photo we may republish, with what the credit page needs. */
export interface PhotoChoice {
  url: string;
  title: string;
  author: string;
  license: string;
  licenseUrl: string;
  sourceUrl: string;
  /** Where the choice came from: the story's own image or a Commons search. */
  origin: 'feed' | 'commons';
  description: string;
}

/**
 * Licences that let us republish with credit: public domain, CC0, CC BY and CC BY-SA. NC and ND variants,
 * "all rights reserved" and anything unrecognised do not count.
 */
export function isReusableLicense(text: string | null | undefined): boolean {
  if (!text) return false;
  const value = text.toLowerCase();
  if (/(^|[\s/-])(nc|nd)([\s/-]|$)|noncommercial|no-?derivs|all rights reserved/.test(value))
    return false;
  return (
    /creativecommons\.org\/publicdomain\/(zero|mark)/.test(value) ||
    /creativecommons\.org\/licenses\/by(-sa)?\//.test(value) ||
    /^(cc0|public domain|pd\b|cc[ -]by(-sa)?\b)/.test(value.trim())
  );
}

export interface CommonsCandidate {
  title: string;
  url: string;
  mime: string;
  author: string;
  license: string;
  licenseUrl: string;
  sourceUrl: string;
  description: string;
}

/**
 * The photo for a story: its own image only when the feed states a reusable licence; otherwise the first
 * openly licensed Commons candidate (a JPEG, PNG or WebP with a licence URL and an author); otherwise none.
 */
export function choosePhoto(
  item: Pick<FeedItem, 'imageUrl' | 'imageLicense' | 'link' | 'title'>,
  publisher: string,
  candidates: readonly CommonsCandidate[],
): PhotoChoice | null {
  if (item.imageUrl && isReusableLicense(item.imageLicense)) {
    const license = item.imageLicense as string;
    return {
      url: item.imageUrl,
      title: item.title,
      author: publisher,
      license: /^https?:/i.test(license) ? 'Creative Commons' : license,
      licenseUrl: /^https?:/i.test(license) ? license : item.link,
      sourceUrl: item.link,
      origin: 'feed',
      description: item.title,
    };
  }
  const open = candidates.find(
    (c) =>
      /^image\/(jpeg|png|webp)$/.test(c.mime) &&
      isReusableLicense(c.license) &&
      c.author.trim() !== '' &&
      /^https:\/\//.test(c.licenseUrl) &&
      /^https:\/\//.test(c.sourceUrl),
  );
  return open ? { ...open, origin: 'commons' } : null;
}

const COMMONS_API = 'https://commons.wikimedia.org/w/api.php';

const plain = (html: string | undefined) =>
  (html ?? '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();

interface CommonsPage {
  title: string;
  imageinfo?: Array<{
    thumburl?: string;
    url: string;
    mime: string;
    descriptionurl: string;
    extmetadata?: Record<string, { value?: string } | undefined>;
  }>;
}

/** Parse a Commons `query` response into candidates; pure so it can be tested with a fixture. */
export function parseCommonsResponse(body: unknown): CommonsCandidate[] {
  const pages = Object.values(
    ((body as { query?: { pages?: Record<string, CommonsPage> } })?.query?.pages ?? {}) as Record<
      string,
      CommonsPage
    >,
  );
  const out: CommonsCandidate[] = [];
  for (const page of pages) {
    const info = page.imageinfo?.[0];
    if (!info) continue;
    const meta = info.extmetadata ?? {};
    out.push({
      title: page.title,
      url: info.thumburl ?? info.url,
      mime: info.mime,
      author: plain(meta.Artist?.value),
      license: plain(meta.LicenseShortName?.value),
      licenseUrl: plain(meta.LicenseUrl?.value),
      sourceUrl: info.descriptionurl,
      description: plain(meta.ImageDescription?.value),
    });
  }
  return out;
}

/** Search Wikimedia Commons for photos of a subject; a failure returns no candidates. */
export async function searchCommons(
  query: string,
  fetchImpl: typeof fetch = fetch,
): Promise<CommonsCandidate[]> {
  const params = new URLSearchParams({
    action: 'query',
    format: 'json',
    generator: 'search',
    gsrnamespace: '6',
    gsrlimit: '8',
    gsrsearch: `${query} filetype:bitmap`,
    prop: 'imageinfo',
    iiprop: 'url|mime|extmetadata',
    iiurlwidth: '1280',
    origin: '*',
  });
  try {
    const res = await fetchImpl(`${COMMONS_API}?${params}`, {
      headers: { 'user-agent': 'vCraftNewsImport/1.0 (village news; contact via site)' },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return [];
    return parseCommonsResponse(await res.json());
  } catch {
    return [];
  }
}
