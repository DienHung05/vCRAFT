import { EMBEDDING_DIMENSIONS, type Embedder } from './types';

/**
 * OpenAI embeddings (ADR-19): `OPENAI_EMBEDDING_MODEL` at `OPENAI_EMBEDDING_DIMENSIONS` (1024), called over
 * HTTPS with no SDK. Inputs go in batches of up to 64.
 */
export class OpenAiEmbedder implements Embedder {
  constructor(
    private readonly apiKey: string,
    private readonly model: string,
    private readonly dimensions = EMBEDDING_DIMENSIONS,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async embed(texts: readonly string[]): Promise<number[][]> {
    const out: number[][] = [];
    for (let i = 0; i < texts.length; i += 64) {
      const batch = texts.slice(i, i + 64);
      const res = await this.fetchImpl('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: { authorization: `Bearer ${this.apiKey}`, 'content-type': 'application/json' },
        body: JSON.stringify({ model: this.model, input: batch, dimensions: this.dimensions }),
        signal: AbortSignal.timeout(30_000),
      });
      if (!res.ok) throw new Error(`OpenAI embeddings failed: ${res.status}`);
      const body = (await res.json()) as { data: { index: number; embedding: number[] }[] };
      for (const item of [...body.data].sort((a, b) => a.index - b.index)) out.push(item.embedding);
    }
    return out;
  }
}

/**
 * A deterministic stand-in for tests, CI and the offline demo: hashes the folded words of a text into a
 * fixed-size bag-of-words vector, so texts sharing words are close. Not semantic, but stable.
 */
export class HashingEmbedder implements Embedder {
  constructor(private readonly dimensions = EMBEDDING_DIMENSIONS) {}

  async embed(texts: readonly string[]): Promise<number[][]> {
    return texts.map((text) => {
      const vector = new Array<number>(this.dimensions).fill(0);
      const words = text
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/[đĐ]/g, 'd')
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((word) => word.length > 1);
      for (const word of words) {
        let hash = 2166136261;
        for (let i = 0; i < word.length; i++) {
          hash ^= word.charCodeAt(i);
          hash = Math.imul(hash, 16777619);
        }
        const index = (hash >>> 0) % this.dimensions;
        vector[index] = (vector[index] ?? 0) + 1;
      }
      return vector;
    });
  }
}
