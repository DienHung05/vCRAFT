import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { MikroORM } from '@mikro-orm/core';
import {
  Household,
  type KnowledgeSourceType,
  News,
  Product,
  publicDocuments,
} from '@vcraft/database';
import {
  type Embedder,
  HashingEmbedder,
  InMemoryVectorStore,
  indexDocument,
  OpenAiEmbedder,
  parseKbPage,
  SupabaseVectorStore,
  type VectorStore,
} from '@vcraft/knowledge';

/** Payload of the `assistant.ingest` job, from the `knowledge.changed` outbox event. */
export interface AssistantIngestJob {
  sourceType: KnowledgeSourceType;
  sourceId: string;
}

export interface KnowledgeDeps {
  orm: MikroORM;
  store: VectorStore;
  embedder: Embedder;
}

/**
 * The index and embedder from the environment: Supabase pgvector and OpenAI when configured, otherwise
 * the in-memory store and the hashing embedder (tests, CI, offline demo). `ASSISTANT_VECTOR_STORE=memory`
 * forces the in-memory store.
 */
export function knowledgeFromEnv(env: NodeJS.ProcessEnv = process.env): {
  store: VectorStore;
  embedder: Embedder;
} {
  const url = env.SUPABASE_URL?.trim();
  const secret = env.SUPABASE_SECRET_KEY?.trim();
  const store =
    url && secret && env.ASSISTANT_VECTOR_STORE !== 'memory'
      ? new SupabaseVectorStore(url, secret)
      : new InMemoryVectorStore();
  const key = env.OPENAI_API_KEY?.trim();
  const embedder = key
    ? new OpenAiEmbedder(
        key,
        env.OPENAI_EMBEDDING_MODEL?.trim() || 'text-embedding-3-large',
        Number(env.OPENAI_EMBEDDING_DIMENSIONS) || 1024,
      )
    : new HashingEmbedder();
  return { store, embedder };
}

/**
 * Re-indexes one source: indexed if it is public, removed from the index if not (unpublished, hidden,
 * locked, deleted). A household change also re-indexes its products, whose visibility follows it.
 * Idempotent: each source's chunks are replaced as a whole.
 */
export async function ingestSource(deps: KnowledgeDeps, job: AssistantIngestJob): Promise<number> {
  const em = deps.orm.em.fork();
  const docs = await publicDocuments(em, job.sourceType, job.sourceId);
  let chunks = 0;
  if (docs.length === 0) await deps.store.deleteSource(job.sourceType, job.sourceId);
  for (const doc of docs) chunks += await indexDocument(deps.store, deps.embedder, doc);
  if (job.sourceType === 'HOUSEHOLD') {
    const products = await em.find(Product, { household: job.sourceId }, { fields: ['id'] });
    for (const { id } of products)
      chunks += await ingestSource(deps, { sourceType: 'PRODUCT', sourceId: id });
  }
  return chunks;
}

/** The hand-written FAQ topics and the page each one cites (docs/assistant-kb). */
export const KB_PAGES = [
  { id: 'ordering', url: { vi: '/vi/san-pham', en: '/en/products' } },
  { id: 'quotation', url: { vi: '/vi/yeu-cau-bao-gia/moi', en: '/en/quotes/new' } },
  { id: 'qr-traceability', url: { vi: '/vi/san-pham', en: '/en/products' } },
  {
    id: 'household-registration',
    url: { vi: '/vi/dang-ky-nghe-nhan', en: '/en/register-household' },
  },
  { id: 'bat-trang', url: { vi: '/vi/ban-do', en: '/en/map' } },
] as const;

/** Indexes the knowledge base pages from `docs/assistant-kb` (both languages). */
export async function ingestKnowledgeBase(deps: KnowledgeDeps, kbDir: string): Promise<number> {
  let chunks = 0;
  for (const page of KB_PAGES) {
    for (const locale of ['vi', 'en'] as const) {
      const markdown = await readFile(join(kbDir, `${page.id}.${locale}.md`), 'utf8');
      chunks += await indexDocument(
        deps.store,
        deps.embedder,
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

/**
 * Rebuilds the whole index (`pnpm assistant:reindex`): the knowledge base, then every approved household,
 * which brings its published products, then every public news item.
 */
export async function reindexAll(deps: KnowledgeDeps, kbDir: string) {
  const em = deps.orm.em.fork();
  const kb = await ingestKnowledgeBase(deps, kbDir);
  let sources = 0;
  let chunks = kb;
  for (const { id } of await em.find(Household, { status: 'APPROVED' }, { fields: ['id'] })) {
    chunks += await ingestSource(deps, { sourceType: 'HOUSEHOLD', sourceId: id });
    sources++;
  }
  for (const { id } of await em.find(
    News,
    { status: 'PUBLISHED', visibility: 'PUBLIC' },
    { fields: ['id'] },
  )) {
    chunks += await ingestSource(deps, { sourceType: 'NEWS', sourceId: id });
    sources++;
  }
  return { sources, chunks };
}
