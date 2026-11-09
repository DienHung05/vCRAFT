import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { indexDocument, parseKbPage } from './index-document';
import type { Embedder, VectorStore } from './types';

/** The hand-written FAQ topics and the page each one cites (docs/assistant-kb). */
export const KB_PAGES = [
  { id: 'user-guide', url: { vi: '/vi', en: '/en' } },
  { id: 'accounts', url: { vi: '/vi/tai-khoan', en: '/en/account' } },
  { id: 'browsing', url: { vi: '/vi/san-pham', en: '/en/products' } },
  { id: 'ordering', url: { vi: '/vi/san-pham', en: '/en/products' } },
  { id: 'quotation', url: { vi: '/vi/yeu-cau-bao-gia/moi', en: '/en/quotes/new' } },
  { id: 'order-statuses', url: { vi: '/vi/yeu-cau-bao-gia', en: '/en/quotes' } },
  { id: 'studio', url: { vi: '/vi/studio', en: '/en/studio' } },
  { id: 'admin', url: { vi: '/vi/admin', en: '/en/admin' } },
  { id: 'qr-traceability', url: { vi: '/vi/san-pham', en: '/en/products' } },
  {
    id: 'household-registration',
    url: { vi: '/vi/dang-ky-nghe-nhan', en: '/en/register-household' },
  },
  { id: 'bat-trang', url: { vi: '/vi/ban-do', en: '/en/map' } },
  { id: 'faq', url: { vi: '/vi', en: '/en' } },
] as const;

/** Indexes the knowledge base pages from `docs/assistant-kb` (both languages); returns the chunk count. */
export async function ingestKnowledgeBase(
  store: VectorStore,
  embedder: Embedder,
  kbDir: string,
): Promise<number> {
  let chunks = 0;
  for (const page of KB_PAGES) {
    for (const locale of ['vi', 'en'] as const) {
      const markdown = await readFile(join(kbDir, `${page.id}.${locale}.md`), 'utf8');
      chunks += await indexDocument(
        store,
        embedder,
        parseKbPage(markdown, {
          sourceId: page.id,
          locale,
          url: page.url[locale],
          updatedAt: new Date(),
        }),
      );
    }
  }
  return chunks;
}
