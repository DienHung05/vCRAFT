import 'reflect-metadata';
import { join } from 'node:path';
import { MikroORM, type Options } from '@mikro-orm/core';
import { createMikroOrmOptions } from '@vcraft/database';
import { knowledgeFromEnv, reindexAll } from '../processors/assistant/ingest';

/** Monorepo root: this file compiles to `apps/worker/dist/assistant/reindex-cli.js`. */
const ROOT = join(__dirname, '..', '..', '..', '..');

/**
 * `pnpm assistant:reindex` (GH#79): rebuilds the Fox assistant's knowledge index from the knowledge base
 * pages and every public household, product and news item, with OpenAI embeddings into Supabase pgvector
 * (or the in-memory store and hashing embedder when those are not configured, which only checks the run).
 * Safe to repeat: each source's chunks are replaced.
 */
async function main(): Promise<void> {
  const orm = await MikroORM.init(createMikroOrmOptions(process.env) as unknown as Options);
  try {
    const { store, embedder } = knowledgeFromEnv();
    console.log(`index: ${store.constructor.name}, embeddings: ${embedder.constructor.name}`);
    const result = await reindexAll({ orm, store, embedder }, join(ROOT, 'docs', 'assistant-kb'));
    console.log(
      `indexed ${result.sources} sources and the knowledge base: ${result.chunks} chunks`,
    );
  } finally {
    await orm.close();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
