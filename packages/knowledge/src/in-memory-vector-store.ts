import type { KnowledgeChunk, KnowledgeMatch, KnowledgeSource, VectorStore } from './types';

export function cosineSimilarity(a: readonly number[], b: readonly number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    const x = a[i] ?? 0;
    const y = b[i] ?? 0;
    dot += x * y;
    na += x * x;
    nb += y * y;
  }
  return na === 0 || nb === 0 ? 0 : dot / Math.sqrt(na * nb);
}

/** The index in process memory: tests, CI and the offline demo when Supabase is unreachable (ADR-13). */
export class InMemoryVectorStore implements VectorStore {
  private readonly chunks = new Map<string, KnowledgeChunk[]>();

  async replaceSource(
    sourceType: KnowledgeSource,
    sourceId: string,
    chunks: readonly KnowledgeChunk[],
  ): Promise<void> {
    this.chunks.set(`${sourceType}:${sourceId}`, [...chunks]);
  }

  async deleteSource(sourceType: KnowledgeSource, sourceId: string): Promise<void> {
    this.chunks.delete(`${sourceType}:${sourceId}`);
  }

  async search(
    embedding: readonly number[],
    options: Parameters<VectorStore['search']>[1],
  ): Promise<KnowledgeMatch[]> {
    const min = options.minSimilarity ?? 0;
    return [...this.chunks.values()]
      .flat()
      .filter((chunk) => !options.locales || options.locales.includes(chunk.locale))
      .filter((chunk) => !options.sourceType || chunk.sourceType === options.sourceType)
      .map((chunk) => ({
        sourceType: chunk.sourceType,
        sourceId: chunk.sourceId,
        url: chunk.url,
        title: chunk.title,
        content: chunk.content,
        similarity: cosineSimilarity(embedding, chunk.embedding),
      }))
      .filter((match) => match.similarity >= min)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, options.limit);
  }

  /** Every stored chunk, for tests and the offline snapshot. */
  all(): KnowledgeChunk[] {
    return [...this.chunks.values()].flat();
  }
}
