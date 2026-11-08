import { describe, expect, it } from 'vitest';
import { newsImportConfigFromEnv, newsImportEnabled } from '../src/processors/news-import/config';
import {
  canonicalUrl,
  duplicateOf,
  nearIdenticalTitles,
} from '../src/processors/news-import/dedup';
import { parseFeed } from '../src/processors/news-import/feed';
import {
  buildFillerPrompt,
  FILLER_RULES,
  fillerBody,
  needsFiller,
  parseFillerArticle,
} from '../src/processors/news-import/filler';
import {
  type CommonsCandidate,
  choosePhoto,
  isReusableLicense,
  parseCommonsResponse,
} from '../src/processors/news-import/photos';
import { relevance } from '../src/processors/news-import/relevance';
import { fallbackText } from '../src/processors/news-import/text';

const RSS = `<?xml version="1.0"?>
<rss version="2.0" xmlns:media="http://search.yahoo.com/mrss/">
  <channel>
    <title>Báo mẫu</title>
    <item>
      <title><![CDATA[Làng gốm Bát Tràng đón khách dịp lễ]]></title>
      <link>https://example.vn/lang-gom-bat-trang?utm_source=rss</link>
      <pubDate>Tue, 04 Nov 2025 03:00:00 +0000</pubDate>
      <description><![CDATA[<p>Hàng trăm du khách &amp; thợ <b>gốm</b> tại Bát Tràng.</p>]]></description>
      <media:content url="https://example.vn/a.jpg" medium="image"/>
    </item>
    <item>
      <title>Thời tiết Hà Nội</title>
      <link>https://example.vn/thoi-tiet</link>
      <description>Nắng đẹp.</description>
    </item>
    <item>
      <title>No link here</title>
    </item>
  </channel>
</rss>`;

describe('feed parsing', () => {
  it('reads RSS items, resolves CDATA and entities, and drops items without a link', () => {
    const items = parseFeed(RSS);
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({
      title: 'Làng gốm Bát Tràng đón khách dịp lễ',
      imageUrl: 'https://example.vn/a.jpg',
      imageLicense: null,
    });
    expect(items[0]?.description).toBe('Hàng trăm du khách & thợ gốm tại Bát Tràng.');
    expect(items[0]?.publishedAt?.toISOString()).toBe('2025-11-04T03:00:00.000Z');
  });

  it('reads Atom entries and survives garbage', () => {
    const atom = `<feed><entry><title>Gốm Bát Tràng</title><link href="https://x.vn/a"/><updated>2025-01-02T00:00:00Z</updated><summary>Tóm tắt</summary></entry></feed>`;
    expect(parseFeed(atom)[0]).toMatchObject({ link: 'https://x.vn/a', description: 'Tóm tắt' });
    expect(parseFeed('<<<not xml')).toEqual([]);
    expect(parseFeed('')).toEqual([]);
  });
});

describe('relevance filter', () => {
  const config = { villages: ['Bát Tràng'], crafts: ['gốm', 'sứ'] };
  it('keeps stories naming a village and a craft, ignoring accents and case', () => {
    expect(relevance({ title: 'BAT TRANG: gom sứ', description: '' }, config)).toBe('relevant');
    expect(relevance({ title: 'Làng gốm', description: 'ở Bát Tràng' }, config)).toBe('relevant');
  });
  it('says why a story is dropped', () => {
    expect(relevance({ title: 'Gốm sứ Hải Dương', description: '' }, config)).toBe('no-village');
    expect(relevance({ title: 'Bát Tràng mở hội', description: 'lễ hội' }, config)).toBe(
      'no-craft',
    );
  });
  it('matches whole words only', () => {
    expect(relevance({ title: 'Bát Tràng gốmmm', description: '' }, config)).toBe('no-craft');
  });
});

describe('dedup', () => {
  it('canonicalises tracking parameters, www, fragment and trailing slash', () => {
    expect(canonicalUrl('https://www.Example.vn/a/b/?utm_source=x&id=2#top')).toBe(
      'example.vn/a/b?id=2',
    );
    expect(canonicalUrl('https://example.vn/a/b?id=2')).toBe('example.vn/a/b?id=2');
  });
  it('flags the same URL and near-identical titles', () => {
    const known = [
      { url: 'https://example.vn/a?utm_medium=y', title: 'Hội chợ gốm Bát Tràng 2025' },
    ];
    expect(duplicateOf({ link: 'https://www.example.vn/a/', title: 'khác hẳn' }, known)).toBe(
      'same-url',
    );
    expect(
      duplicateOf({ link: 'https://other.vn/z', title: 'Hội chợ gốm Bát Tràng 2025!' }, known),
    ).toBe('similar-title');
    expect(
      duplicateOf({ link: 'https://other.vn/z', title: 'Lò nung mới ở Bát Tràng' }, known),
    ).toBe(null);
    expect(nearIdenticalTitles('', 'x')).toBe(false);
  });
});

const candidate = (over: Partial<CommonsCandidate> = {}): CommonsCandidate => ({
  title: 'File:Bat Trang.jpg',
  url: 'https://upload.wikimedia.org/x.jpg',
  mime: 'image/jpeg',
  author: 'Someone',
  license: 'CC BY-SA 4.0',
  licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0',
  sourceUrl: 'https://commons.wikimedia.org/wiki/File:Bat_Trang.jpg',
  description: 'A pottery market',
  ...over,
});

describe('licence-based photo choice', () => {
  it('accepts open licences and refuses NC, ND and unknown ones', () => {
    for (const ok of [
      'CC0',
      'CC BY 4.0',
      'CC BY-SA 3.0',
      'Public domain',
      'https://creativecommons.org/licenses/by/4.0/',
    ])
      expect(isReusableLicense(ok), ok).toBe(true);
    for (const bad of [
      'CC BY-NC 4.0',
      'CC BY-ND 2.0',
      'All rights reserved',
      '',
      null,
      'Bản quyền thuộc báo',
    ])
      expect(isReusableLicense(bad), String(bad)).toBe(false);
  });

  it("uses the story's own image only when the feed licence allows it", () => {
    const own = {
      imageUrl: 'https://example.vn/a.jpg',
      imageLicense: 'https://creativecommons.org/licenses/by/4.0/',
      link: 'https://example.vn/story',
      title: 'Story',
    };
    expect(choosePhoto(own, 'Báo A', [candidate()])?.origin).toBe('feed');
    expect(choosePhoto({ ...own, imageLicense: null }, 'Báo A', [candidate()])?.origin).toBe(
      'commons',
    );
    expect(
      choosePhoto({ ...own, imageLicense: 'CC BY-NC 4.0' }, 'Báo A', [candidate()])?.origin,
    ).toBe('commons');
  });

  it('skips Commons files without an open licence, an author or a usable type', () => {
    const none = { imageUrl: null, imageLicense: null, link: 'https://e.vn/s', title: 'S' };
    expect(
      choosePhoto(none, 'P', [
        candidate({ license: 'CC BY-NC 4.0' }),
        candidate({ author: '' }),
        candidate({ mime: 'image/svg+xml' }),
      ]),
    ).toBeNull();
    expect(
      choosePhoto(none, 'P', [candidate({ license: 'CC BY-NC 4.0' }), candidate()])?.title,
    ).toBe('File:Bat Trang.jpg');
  });

  it('parses a Commons API response fixture', () => {
    const body = {
      query: {
        pages: {
          '1': {
            title: 'File:Bat Trang.jpg',
            imageinfo: [
              {
                thumburl: 'https://upload.wikimedia.org/t.jpg',
                url: 'https://upload.wikimedia.org/o.jpg',
                mime: 'image/jpeg',
                descriptionurl: 'https://commons.wikimedia.org/wiki/File:Bat_Trang.jpg',
                extmetadata: {
                  Artist: { value: '<a href="x">Jane</a>' },
                  LicenseShortName: { value: 'CC BY-SA 4.0' },
                  LicenseUrl: { value: 'https://creativecommons.org/licenses/by-sa/4.0' },
                  ImageDescription: { value: 'Market &amp; stalls' },
                },
              },
            ],
          },
        },
      },
    };
    expect(parseCommonsResponse(body)).toEqual([
      expect.objectContaining({
        author: 'Jane',
        license: 'CC BY-SA 4.0',
        description: 'Market & stalls',
      }),
    ]);
    expect(parseCommonsResponse({})).toEqual([]);
  });
});

describe('filler', () => {
  it('runs only below the threshold of stories published in the last 30 days', () => {
    expect(needsFiller(5, 6)).toBe(true);
    expect(needsFiller(6, 6)).toBe(false);
    expect(needsFiller(0, 6)).toBe(true);
  });

  it('forbids invention and requires references in the generator prompt', () => {
    const [system] = buildFillerPrompt({ title: 'Firing ceramics' });
    const text = system?.content ?? '';
    for (const rule of FILLER_RULES) expect(text).toContain(rule);
    expect(text).toMatch(
      /Do NOT invent events, dates, people, quotes, prices, orders or households/,
    );
    expect(text).toMatch(/references/);
    expect(buildFillerPrompt({ title: 'Firing ceramics' })[1]?.content).toContain(
      'Firing ceramics',
    );
  });

  it('rejects answers without paragraphs or references and keeps the references in the body', () => {
    expect(
      parseFillerArticle('{"title":"a","summary":"b","paragraphs":["x","y"],"references":[]}'),
    ).toBeNull();
    expect(
      parseFillerArticle('{"title":"a","summary":"b","paragraphs":["x"],"references":["r"]}'),
    ).toBeNull();
    expect(parseFillerArticle('nope')).toBeNull();
    const article = parseFillerArticle(
      '{"title":"Nung gốm","summary":"Tóm tắt","paragraphs":["Đoạn 1","Đoạn 2"],"references":["Sách A"]}',
    );
    expect(article).not.toBeNull();
    expect(fillerBody(article as NonNullable<typeof article>)).toContain('- Sách A');
  });
});

describe('text without an LLM', () => {
  it('stores a one-line summary from the snippet, never the full text', () => {
    const long = 'Gốm '.repeat(400);
    const text = fallbackText({ title: 'T', description: long }, 'Báo A');
    expect(text.summary.length).toBeLessThanOrEqual(220);
    expect(text.body).toContain('Báo A');
    expect(text.body.length).toBeLessThan(400);
  });
});

describe('configuration', () => {
  it('is off without a valid https feed', () => {
    expect(newsImportEnabled(newsImportConfigFromEnv({}))).toBe(false);
    expect(
      newsImportEnabled(newsImportConfigFromEnv({ NEWS_IMPORT_FEEDS: 'http://insecure/feed' })),
    ).toBe(false);
  });
  it('reads feeds with optional publisher names and sane defaults', () => {
    const config = newsImportConfigFromEnv({
      NEWS_IMPORT_FEEDS: 'Báo A|https://a.vn/rss;https://www.b.vn/feed',
      NEWS_IMPORT_PUBLISH: 'false',
      NEWS_FILLER_MIN_PUBLISHED: '4',
    });
    expect(config.feeds).toEqual([
      { publisher: 'Báo A', url: 'https://a.vn/rss' },
      { publisher: 'b.vn', url: 'https://www.b.vn/feed' },
    ]);
    expect(config).toMatchObject({
      publish: false,
      fillerThreshold: 4,
      maxPerRun: 5,
      villages: ['Bát Tràng'],
    });
    expect(newsImportConfigFromEnv({}).fillerThreshold).toBe(6);
  });
});
