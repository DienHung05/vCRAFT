/** Where a piece of knowledge comes from; also the citation type the assistant shows. */
export const KNOWLEDGE_SOURCES = ['FAQ', 'PRODUCT', 'HOUSEHOLD', 'NEWS'] as const;
export type KnowledgeSource = (typeof KNOWLEDGE_SOURCES)[number];

/** The number of dimensions of every embedding: `knowledge_chunks.embedding vector(1024)` (ADR-19). */
export const EMBEDDING_DIMENSIONS = 1024;

/**
 * A public document before chunking: a FAQ page, an approved household's product, a public household
 * profile or a public news item (BR-02). Only public content is ever indexed.
 */
export interface KnowledgeDocument {
  sourceType: KnowledgeSource;
  sourceId: string;
  locale: 'vi' | 'en';
  /** Internal path the citation links to (`/vi/san-pham/...`). */
  url: string;
  title: string;
  text: string;
  sourceUpdatedAt: Date;
}

/** One embedded slice of a document, as stored in `knowledge_chunks`. */
export interface KnowledgeChunk {
  sourceType: KnowledgeSource;
  sourceId: string;
  locale: 'vi' | 'en';
  chunkIndex: number;
  url: string;
  title: string;
  content: string;
  embedding: number[];
  sourceUpdatedAt: Date;
}

export interface KnowledgeMatch {
  sourceType: KnowledgeSource;
  sourceId: string;
  url: string;
  title: string;
  content: string;
  /** Cosine similarity, 1 is identical. */
  similarity: number;
}

/**
 * The derived, rebuildable knowledge index (ADR-13). Writing a source replaces all of its chunks, so
 * re-indexing is idempotent; deleting removes a source that is no longer public.
 */
export interface VectorStore {
  replaceSource(
    sourceType: KnowledgeSource,
    sourceId: string,
    chunks: readonly KnowledgeChunk[],
  ): Promise<void>;
  deleteSource(sourceType: KnowledgeSource, sourceId: string): Promise<void>;
  search(
    embedding: readonly number[],
    options: { locale?: 'vi' | 'en'; limit: number; minSimilarity?: number },
  ): Promise<KnowledgeMatch[]>;
}

/** Turns text into embeddings (OpenAI in production, a deterministic fake in tests and offline). */
export interface Embedder {
  embed(texts: readonly string[]): Promise<number[][]>;
}
