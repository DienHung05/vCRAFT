import { Global, Module } from '@nestjs/common';
import {
  type Embedder,
  HashingEmbedder,
  InMemoryVectorStore,
  OpenAiEmbedder,
  SupabaseVectorStore,
  type VectorStore,
} from '@vcraft/knowledge';

/** DI token of the assistant's knowledge index (`VectorStore` port, ADR-13). */
export const VECTOR_STORE = Symbol('VECTOR_STORE');
/** DI token of the embedder that turns questions into query vectors (ADR-19). */
export const EMBEDDER = Symbol('EMBEDDER');

export type { Embedder, VectorStore };

/**
 * The `VectorStore` port for the API: `SupabaseVectorStore` (pgvector, secret key, backend only) when
 * Supabase is configured, otherwise `InMemoryVectorStore` for tests, CI and the offline demo
 * (`ASSISTANT_VECTOR_STORE=memory` forces it). The adapters live in `@vcraft/knowledge`, shared with the
 * worker's `assistant.ingest` job, which writes the same index.
 */
@Global()
@Module({
  providers: [
    {
      provide: VECTOR_STORE,
      useFactory: (): VectorStore => {
        const url = process.env.SUPABASE_URL?.trim();
        const secret = process.env.SUPABASE_SECRET_KEY?.trim();
        return url && secret && process.env.ASSISTANT_VECTOR_STORE !== 'memory'
          ? new SupabaseVectorStore(url, secret)
          : new InMemoryVectorStore();
      },
    },
    {
      provide: EMBEDDER,
      useFactory: (): Embedder => {
        const key = process.env.OPENAI_API_KEY?.trim();
        return key
          ? new OpenAiEmbedder(
              key,
              process.env.OPENAI_EMBEDDING_MODEL?.trim() || 'text-embedding-3-large',
              Number(process.env.OPENAI_EMBEDDING_DIMENSIONS) || 1024,
            )
          : new HashingEmbedder();
      },
    },
  ],
  exports: [VECTOR_STORE, EMBEDDER],
})
export class VectorModule {}
