import type { MikroORM } from '@mikro-orm/core';
import { HashingEmbedder, InMemoryVectorStore } from '@vcraft/knowledge';
import { describe, expect, it } from 'vitest';
import { KnowledgeBootstrapService } from './knowledge-bootstrap.service';

/** An ORM with no public content, so only the hand-written guides are loaded. */
const emptyOrm = { em: { fork: () => ({ find: async () => [] }) } } as unknown as MikroORM;

describe('KnowledgeBootstrapService', () => {
  it('fills the in-memory store with the guides in both languages', async () => {
    const store = new InMemoryVectorStore();
    const service = new KnowledgeBootstrapService(store, new HashingEmbedder(), emptyOrm);
    service.onApplicationBootstrap();
    await service.ready;
    const chunks = store.all();
    expect(chunks.length).toBeGreaterThan(0);
    expect(new Set(chunks.map((c) => c.locale))).toEqual(new Set(['vi', 'en']));
    expect(chunks.every((c) => c.sourceType === 'FAQ')).toBe(true);
  });

  it('leaves a non-memory store alone', async () => {
    const calls: string[] = [];
    const store = {
      replaceSource: async () => void calls.push('replace'),
      deleteSource: async () => undefined,
      search: async () => [],
    };
    const service = new KnowledgeBootstrapService(store, new HashingEmbedder(), emptyOrm);
    service.onApplicationBootstrap();
    await service.ready;
    expect(calls).toEqual([]);
  });
});
