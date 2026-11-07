import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { KnowledgeChunk, KnowledgeMatch, KnowledgeSource, VectorStore } from './types';

interface MatchRow {
  source_type: KnowledgeSource;
  source_id: string;
  url: string;
  title: string;
  content: string;
  similarity: number;
}

/**
 * `knowledge_chunks` on the Supabase project's Postgres with pgvector (ADR-13). It uses the secret key,
 * so it runs only in the API and the worker; RLS denies `anon` and `authenticated` entirely.
 */
export class SupabaseVectorStore implements VectorStore {
  private readonly client: SupabaseClient;

  constructor(url: string, secretKey: string) {
    this.client = createClient(url, secretKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  async replaceSource(
    sourceType: KnowledgeSource,
    sourceId: string,
    chunks: readonly KnowledgeChunk[],
  ): Promise<void> {
    await this.deleteSource(sourceType, sourceId);
    if (chunks.length === 0) return;
    const { error } = await this.client.from('knowledge_chunks').insert(
      chunks.map((chunk) => ({
        source_type: chunk.sourceType,
        source_id: chunk.sourceId,
        locale: chunk.locale,
        chunk_index: chunk.chunkIndex,
        url: chunk.url,
        title: chunk.title,
        visibility: 'PUBLIC',
        content: chunk.content,
        // pgvector accepts the JSON array text form.
        embedding: JSON.stringify(chunk.embedding),
        source_updated_at: chunk.sourceUpdatedAt.toISOString(),
      })),
    );
    if (error) throw new Error(`knowledge insert failed: ${error.message}`);
  }

  async deleteSource(sourceType: KnowledgeSource, sourceId: string): Promise<void> {
    const { error } = await this.client
      .from('knowledge_chunks')
      .delete()
      .eq('source_type', sourceType)
      .eq('source_id', sourceId);
    if (error) throw new Error(`knowledge delete failed: ${error.message}`);
  }

  async search(
    embedding: readonly number[],
    options: Parameters<VectorStore['search']>[1],
  ): Promise<KnowledgeMatch[]> {
    const { data, error } = await this.client.rpc(
      options.sourceType ? 'match_knowledge_by_source' : 'match_knowledge',
      {
        query_embedding: JSON.stringify(embedding),
        match_count: options.limit,
        filter_locale: options.locale ?? null,
        min_similarity: options.minSimilarity ?? 0,
        ...(options.sourceType && { filter_source_type: options.sourceType }),
      },
    );
    if (error) throw new Error(`knowledge search failed: ${error.message}`);
    return ((data ?? []) as MatchRow[]).map((row) => ({
      sourceType: row.source_type,
      sourceId: row.source_id,
      url: row.url,
      title: row.title,
      content: row.content,
      similarity: row.similarity,
    }));
  }
}
