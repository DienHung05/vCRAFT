import { describe, expect, it, vi } from 'vitest';
import {
  CHUNK_CHARS,
  chunkText,
  HashingEmbedder,
  InMemoryVectorStore,
  indexDocument,
  OpenAiEmbedder,
  parseKbPage,
} from '../src';

describe('chunkText', () => {
  it('keeps short text whole and drops empty text', () => {
    expect(chunkText('Một câu ngắn.')).toEqual(['Một câu ngắn.']);
    expect(chunkText('   ')).toEqual([]);
  });

  it('cuts long text at sentence ends within the limit, with overlap', () => {
    const sentence = 'Gốm Bát Tràng nung ở khoảng 1.300 độ C trong lò ga hiện đại. ';
    const chunks = chunkText(sentence.repeat(80));
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) expect(chunk.length).toBeLessThanOrEqual(CHUNK_CHARS);
    expect(chunks.every((c) => c.endsWith('.'))).toBe(true);
    // The next chunk repeats the end of the previous one.
    const tail = (chunks[0] as string).slice(-60);
    expect((chunks[1] as string).includes(tail.slice(-30))).toBe(true);
  });
});

describe('indexing and search', () => {
  const embedder = new HashingEmbedder();
  const doc = (sourceId: string, title: string, text: string) => ({
    sourceType: 'FAQ' as const,
    sourceId,
    locale: 'vi' as const,
    url: `/vi/${sourceId}`,
    title,
    text,
    sourceUpdatedAt: new Date('2026-11-01T00:00:00Z'),
  });

  it('finds the closest document and replaces a source on re-index', async () => {
    const store = new InMemoryVectorStore();
    await indexDocument(
      store,
      embedder,
      doc('dat-hang', 'Đặt hàng số lượng lớn', 'Gửi yêu cầu báo giá để đặt nhiều cốc.'),
    );
    await indexDocument(
      store,
      embedder,
      doc('truy-xuat', 'Truy xuất QR', 'Quét mã QR dưới đáy sản phẩm.'),
    );
    const [query] = await embedder.embed(['lam sao dat 5000 coc bao gia']);
    const [top] = await store.search(query as number[], { limit: 1 });
    expect(top?.sourceId).toBe('dat-hang');

    await indexDocument(store, embedder, doc('dat-hang', 'Đặt hàng', 'Nội dung mới.'));
    expect(store.all().filter((c) => c.sourceId === 'dat-hang')).toHaveLength(1);
    await store.deleteSource('FAQ', 'truy-xuat');
    expect(store.all().map((c) => c.sourceId)).toEqual(['dat-hang']);
  });

  it('filters by locale and similarity', async () => {
    const store = new InMemoryVectorStore();
    await indexDocument(store, embedder, {
      ...doc('a', 'Bát Tràng', 'Làng gốm cổ.'),
      locale: 'en',
    });
    const [query] = await embedder.embed(['bat trang lang gom']);
    expect(await store.search(query as number[], { locale: 'vi', limit: 5 })).toEqual([]);
    expect(await store.search(query as number[], { limit: 5, minSimilarity: 0.99 })).toEqual([]);
  });
});

describe('parseKbPage', () => {
  it('takes the first heading as title and the rest as text', () => {
    expect(
      parseKbPage('# Đặt hàng\n\nGửi yêu cầu báo giá.', {
        sourceId: 'ordering',
        locale: 'vi',
        url: '/vi/yeu-cau-bao-gia',
        updatedAt: new Date(0),
      }),
    ).toMatchObject({
      sourceType: 'FAQ',
      sourceId: 'ordering.vi',
      title: 'Đặt hàng',
      text: 'Gửi yêu cầu báo giá.',
    });
  });
});

describe('OpenAiEmbedder', () => {
  it('posts the model and dimensions and returns embeddings in input order', async () => {
    const fetchImpl = vi.fn(async () =>
      Response.json({
        data: [
          { index: 1, embedding: [0, 1] },
          { index: 0, embedding: [1, 0] },
        ],
      }),
    );
    const embedder = new OpenAiEmbedder(
      'sk-test',
      'text-embedding-3-large',
      1024,
      fetchImpl as never,
    );
    expect(await embedder.embed(['a', 'b'])).toEqual([
      [1, 0],
      [0, 1],
    ]);
    const [, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toEqual({
      model: 'text-embedding-3-large',
      input: ['a', 'b'],
      dimensions: 1024,
    });
  });

  it('throws on an API error', async () => {
    const embedder = new OpenAiEmbedder(
      'k',
      'm',
      1024,
      (async () => new Response('', { status: 429 })) as never,
    );
    await expect(embedder.embed(['a'])).rejects.toThrow(/429/);
  });
});
