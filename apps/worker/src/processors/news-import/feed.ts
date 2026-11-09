/** One story of a news feed, before any filtering (GH#314). */
export interface FeedItem {
  title: string;
  link: string;
  publishedAt: Date | null;
  /** Plain-text snippet from the feed; never the full article. */
  description: string;
  imageUrl: string | null;
  /** Licence statement the feed gives for its image (a URL or text); null when it gives none. */
  imageLicense: string | null;
}

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
};

function decode(text: string): string {
  return text
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) =>
      String.fromCodePoint(Number.parseInt(hex, 16)),
    )
    .replace(/&#(\d+);/g, (_, dec: string) => String.fromCodePoint(Number(dec)))
    .replace(/&([a-z]+);/gi, (whole, name: string) => ENTITIES[name.toLowerCase()] ?? whole);
}

/** Text of the first `<tag>` (a namespace prefix is part of `tag`), with CDATA and entities resolved. */
function textOf(block: string, tag: string): string | null {
  const match = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, 'i').exec(block);
  return match?.[1] === undefined ? null : decode(match[1]).trim();
}

function attributeOf(block: string, tag: string, attribute: string): string | null {
  const match = new RegExp(`<${tag}\\s[^>]*?${attribute}\\s*=\\s*["']([^"']+)["']`, 'i').exec(
    block,
  );
  return match?.[1] === undefined ? null : decode(match[1]);
}

/** Plain text of an HTML snippet. */
export function stripHtml(html: string): string {
  const unwrapped = html.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');
  let text = decode(unwrapped.replace(/<[^>]*>/g, ' '));
  // Some feeds entity-encode their HTML (`&lt;p&gt;`); strip what the decoding revealed too.
  if (/<[a-z/]/i.test(text)) text = text.replace(/<[^>]*>/g, ' ');
  return text.replace(/\s+/g, ' ').trim();
}

function imageOf(block: string, rawDescription: string): string | null {
  for (const tag of block.match(/<enclosure\s[^>]*>/gi) ?? []) {
    if (/type\s*=\s*["']image\//i.test(tag)) {
      const url = /url\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1];
      if (url) return decode(url);
    }
  }
  return (
    attributeOf(block, 'media:content', 'url') ??
    attributeOf(block, 'media:thumbnail', 'url') ??
    /<img\s[^>]*src\s*=\s*["']([^"']+)["']/i.exec(decode(rawDescription))?.[1] ??
    null
  );
}

function dateOf(value: string | null): Date | null {
  if (!value) return null;
  const time = Date.parse(value);
  return Number.isNaN(time) ? null : new Date(time);
}

/**
 * Items of an RSS 2.0 or Atom feed. Forgiving on purpose: an item without a title or an http(s) link is
 * dropped, everything else is optional. A malformed document yields an empty list instead of throwing.
 */
export function parseFeed(xml: string): FeedItem[] {
  const blocks = [
    ...xml.matchAll(/<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/gi),
    ...xml.matchAll(/<entry(?:\s[^>]*)?>([\s\S]*?)<\/entry>/gi),
  ].map((m) => m[1] ?? '');
  const items: FeedItem[] = [];
  for (const block of blocks) {
    const title = textOf(block, 'title');
    const link = textOf(block, 'link') || attributeOf(block, 'link', 'href');
    if (!title || !link || !/^https?:\/\//i.test(link)) continue;
    const rawDescription =
      /<(?:description|summary|content:encoded)(?:\s[^>]*)?>([\s\S]*?)<\/(?:description|summary|content:encoded)>/i.exec(
        block,
      )?.[1] ?? '';
    items.push({
      title: stripHtml(title),
      link,
      publishedAt: dateOf(
        textOf(block, 'pubDate') ??
          textOf(block, 'published') ??
          textOf(block, 'updated') ??
          textOf(block, 'dc:date'),
      ),
      description: stripHtml(rawDescription),
      imageUrl: imageOf(block, rawDescription),
      imageLicense:
        textOf(block, 'media:license') ??
        attributeOf(block, 'media:license', 'href') ??
        textOf(block, 'creativeCommons:license'),
    });
  }
  return items;
}
