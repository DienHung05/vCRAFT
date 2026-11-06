import { chunkText } from './chunk';
import type { Embedder, KnowledgeChunk, KnowledgeDocument, VectorStore } from './types';

/**
 * Chunks, embeds and stores one public document, replacing whatever the source had before, so running it
 * twice gives the same index. The title leads every chunk so each one stands on its own in a search.
 */
export async function indexDocument(
  store: VectorStore,
  embedder: Embedder,
  doc: KnowledgeDocument,
): Promise<number> {
  const parts = chunkText(doc.text).map((part) => `${doc.title}\n\n${part}`);
  const embeddings = parts.length > 0 ? await embedder.embed(parts) : [];
  const chunks: KnowledgeChunk[] = parts.map((content, chunkIndex) => ({
    sourceType: doc.sourceType,
    sourceId: doc.sourceId,
    locale: doc.locale,
    chunkIndex,
    url: doc.url,
    title: doc.title,
    content,
    embedding: embeddings[chunkIndex] ?? [],
    sourceUpdatedAt: doc.sourceUpdatedAt,
  }));
  await store.replaceSource(doc.sourceType, doc.sourceId, chunks);
  return chunks.length;
}

/** Splits a hand-written knowledge base page (`# Title` then body) into a document. */
export function parseKbPage(
  markdown: string,
  meta: { sourceId: string; locale: 'vi' | 'en'; url: string; updatedAt: Date },
): KnowledgeDocument {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const heading = lines.findIndex((line) => line.startsWith('# '));
  const title = heading >= 0 ? (lines[heading] as string).slice(2).trim() : meta.sourceId;
  const text = lines
    .slice(heading + 1)
    .join('\n')
    .trim();
  return {
    sourceType: 'FAQ',
    sourceId: `${meta.sourceId}.${meta.locale}`,
    locale: meta.locale,
    url: meta.url,
    title,
    text,
    sourceUpdatedAt: meta.updatedAt,
  };
}
