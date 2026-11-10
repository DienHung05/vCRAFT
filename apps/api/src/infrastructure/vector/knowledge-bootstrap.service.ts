import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { MikroORM } from '@mikro-orm/core';
import {
  type BeforeApplicationShutdown,
  Inject,
  Injectable,
  Logger,
  type OnApplicationBootstrap,
} from '@nestjs/common';
import { Household, News, Product, publicDocuments } from '@vcraft/database';
import type { Embedder, VectorStore } from '@vcraft/knowledge';
import { InMemoryVectorStore, indexDocument, ingestKnowledgeBase } from '@vcraft/knowledge';
import { EMBEDDER, VECTOR_STORE } from './vector.tokens';

/** `docs/assistant-kb`, found by walking up from this file (src or dist), or `ASSISTANT_KB_DIR`. */
function findKbDir(): string | null {
  const fromEnv = process.env.ASSISTANT_KB_DIR?.trim();
  if (fromEnv) return resolve(fromEnv);
  for (let dir = __dirname; dirname(dir) !== dir; dir = dirname(dir)) {
    const candidate = join(dir, 'docs', 'assistant-kb');
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

/**
 * In memory mode the worker's index is another process, so the API fills its own `InMemoryVectorStore`
 * from the hand-written guides and the public content, in the background after startup. With pgvector
 * the worker owns the index and this does nothing.
 */
@Injectable()
export class KnowledgeBootstrapService
  implements OnApplicationBootstrap, BeforeApplicationShutdown
{
  private readonly logger = new Logger(KnowledgeBootstrapService.name);
  /** Resolves when loading ends (for tests); never rejects. */
  ready: Promise<void> = Promise.resolve();

  /** Set on shutdown: the loader stops at its next checkpoint so it never queries a closing database. */
  private stopped = false;

  constructor(
    @Inject(VECTOR_STORE) private readonly store: VectorStore,
    @Inject(EMBEDDER) private readonly embedder: Embedder,
    @Inject(MikroORM) private readonly orm: MikroORM,
  ) {}

  onApplicationBootstrap(): void {
    if (!(this.store instanceof InMemoryVectorStore)) return;
    this.ready = this.load().catch((error: unknown) =>
      this.logger.warn(`assistant knowledge load failed: ${String(error)}`),
    );
  }

  /** Runs before any `onApplicationShutdown` hook (the ORM closes there): stop loading and wait for the loader to settle. */
  async beforeApplicationShutdown(): Promise<void> {
    this.stopped = true;
    let timer: NodeJS.Timeout | undefined;
    const patience = new Promise<void>((done) => {
      timer = setTimeout(done, 5_000);
    });
    await Promise.race([this.ready, patience]);
    clearTimeout(timer);
  }

  private async load(): Promise<void> {
    const kbDir = findKbDir();
    let guides = 0;
    if (kbDir) guides = await ingestKnowledgeBase(this.store, this.embedder, kbDir);
    else this.logger.warn('docs/assistant-kb not found: guides not loaded');
    let sources = 0;
    let chunks = 0;
    if (this.stopped) return;
    const em = this.orm.em.fork();
    const households = await em.find(Household, { status: 'APPROVED' }, { fields: ['id'] });
    const news = await em.find(
      News,
      { status: 'PUBLISHED', visibility: 'PUBLIC' },
      { fields: ['id'] },
    );
    const jobs = [
      ...households.map(({ id }) => ['HOUSEHOLD', id] as const),
      ...news.map(({ id }) => ['NEWS', id] as const),
    ];
    for (const [sourceType, sourceId] of jobs) {
      if (this.stopped) return;
      for (const doc of await publicDocuments(em, sourceType, sourceId)) {
        chunks += await indexDocument(this.store, this.embedder, doc);
        sources++;
      }
    }
    if (this.stopped) return;
    // Products of approved households.
    for (const { id } of await em.find(Product, { status: 'PUBLISHED' }, { fields: ['id'] })) {
      if (this.stopped) return;
      for (const doc of await publicDocuments(em, 'PRODUCT', id)) {
        chunks += await indexDocument(this.store, this.embedder, doc);
        sources++;
      }
    }
    this.logger.log(
      `assistant knowledge loaded in memory: ${guides} guide chunks, ${sources} public sources (${chunks} chunks)`,
    );
  }
}
