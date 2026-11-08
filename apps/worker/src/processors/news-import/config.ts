export interface NewsFeedSource {
  /** Publisher shown to visitors as "Nguồn: <publisher>". */
  publisher: string;
  url: string;
}

export interface NewsImportConfig {
  feeds: NewsFeedSource[];
  villages: string[];
  crafts: string[];
  /** Publish imported stories at once (default) or save them as drafts. */
  publish: boolean;
  /** Fewer stories than this in the last 30 days lets the filler write evergreen articles. */
  fillerThreshold: number;
  maxPerRun: number;
  everyMinutes: number;
}

const list = (value: string | undefined, fallback: string[], separator = /[\n;,]+/) => {
  const items = (value ?? '')
    .split(separator)
    .map((entry) => entry.trim())
    .filter(Boolean);
  return items.length > 0 ? items : fallback;
};

const positive = (value: string | undefined, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
};

/**
 * Feeds are `NEWS_IMPORT_FEEDS`: entries separated by newline or `;`, each `https://feed-url` or
 * `Publisher|https://feed-url`. Without a publisher name the host is used. No valid feed means the job is off.
 */
export function newsImportConfigFromEnv(env: NodeJS.ProcessEnv = process.env): NewsImportConfig {
  const feeds: NewsFeedSource[] = [];
  for (const entry of list(env.NEWS_IMPORT_FEEDS, [], /[\n;]+/)) {
    const [first, second] = entry.includes('|') ? entry.split('|', 2) : [undefined, entry];
    const url = (second ?? '').trim();
    if (!/^https:\/\//i.test(url)) continue;
    let host = url;
    try {
      host = new URL(url).hostname.replace(/^www\./, '');
    } catch {
      continue;
    }
    feeds.push({ publisher: (first ?? '').trim() || host, url });
  }
  return {
    feeds,
    villages: list(env.NEWS_IMPORT_VILLAGES, ['Bát Tràng']),
    crafts: list(env.NEWS_IMPORT_CRAFTS, ['gốm', 'sứ', 'gốm sứ', 'ceramic', 'pottery']),
    publish: (env.NEWS_IMPORT_PUBLISH ?? 'true').trim().toLowerCase() !== 'false',
    fillerThreshold: positive(env.NEWS_FILLER_MIN_PUBLISHED, 6),
    maxPerRun: positive(env.NEWS_IMPORT_MAX_PER_RUN, 5),
    everyMinutes: positive(env.NEWS_IMPORT_EVERY_MINUTES, 360),
  };
}

/** The import is on only when at least one feed is configured. */
export const newsImportEnabled = (config: NewsImportConfig): boolean => config.feeds.length > 0;
