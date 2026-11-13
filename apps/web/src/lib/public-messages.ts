/**
 * Message subtrees the browser needs on the public pages (GH#481).
 *
 * `NextIntlClientProvider` serialises every message it is given into the HTML as RSC data. The whole
 * dictionary is ~120 KB of JSON, most of it the studio, admin and account forms, which delays the
 * streamed page content (and the images in it) on a slow link. The root layout therefore provides only
 * the paths that client components reachable from the public routes read; the layouts of the
 * signed-in areas wrap their pages in `<FullMessagesProvider>` to get the rest.
 *
 * Server components read their own messages with `getTranslations` and do not need an entry here.
 * `test/public-messages.test.ts` fails when a client component of a public route reads a path that is missing.
 */
export const PUBLIC_MESSAGE_PATHS: readonly string[] = [
  'assistant',
  'auth',
  'catalog',
  'common',
  'errors.generic',
  'exhibition',
  'favourites',
  'home.day',
  'indexPages.news',
  'nav',
  'news.materialPrices',
  'notifications',
  'payments.demo',
  'payments.demoConfirm',
  'payments.kind',
  'payments.method',
  'payments.status',
  'photoAlt',
  'presetFigure',
  'product',
  'rating',
  'stages',
  'trace',
  'villageMap',
];

type MessageTree = { [key: string]: unknown };

function isTree(value: unknown): value is MessageTree {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** True when `path` (dotted, e.g. `payments.demo`) is `granted` or lies below it. */
export function isCoveredBy(path: string, granted: readonly string[]): boolean {
  return granted.some((entry) => path === entry || path.startsWith(`${entry}.`));
}

/** Copies the subtrees at the dotted `paths` out of `messages`; paths that do not exist are skipped. */
export function pickMessages<T extends MessageTree>(
  messages: T,
  paths: readonly string[],
): MessageTree {
  const picked: MessageTree = {};
  for (const path of paths) {
    const keys = path.split('.');
    let source: unknown = messages;
    for (const key of keys) {
      source = isTree(source) ? source[key] : undefined;
    }
    if (source === undefined) continue;
    let target = picked;
    for (const key of keys.slice(0, -1)) {
      const next = target[key];
      if (isTree(next)) {
        target = next;
      } else {
        const created: MessageTree = {};
        target[key] = created;
        target = created;
      }
    }
    const last = keys.at(-1) as string;
    const existing = target[last];
    // A broader path granted earlier already holds this subtree.
    if (existing === undefined || !isTree(source)) target[last] = source;
  }
  return picked;
}
