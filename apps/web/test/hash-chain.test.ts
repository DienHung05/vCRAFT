// @vitest-environment node

import {
  type ChainContent,
  type ChainEntry,
  canonicalJson,
  computeEntryHash,
  GENESIS,
  sealChain,
  sha256Hex,
  verifyChain,
} from '@vcraft/domain';
import { describe, expect, it } from 'vitest';
import { getProducts } from '@/lib/demo/data';

const contents: ChainContent[] = [
  { stage: 'clay', at: '2026-09-02T07:40:00+07:00', note: 'Nhào đất.', mediaChecksums: ['aa'] },
  { stage: 'throw', at: '2026-09-09T08:15:00+07:00', note: 'Vuốt dáng.', mediaChecksums: ['bb'] },
  { stage: 'dry', at: '2026-09-16T15:00:00+07:00', note: 'Phơi mộc.', mediaChecksums: ['cc'] },
  { stage: 'fire', at: '2026-10-03T05:00:00+07:00', note: 'Nung lò.', mediaChecksums: ['dd'] },
];

const PRODUCT = 'BT7K2QXM';

describe('canonicalJson (BR-01)', () => {
  it('sắp khóa tăng dần, không khoảng trắng, giữ thứ tự mảng', () => {
    expect(canonicalJson({ b: 1, a: [3, 1, { d: 'x', c: null }] })).toBe(
      '{"a":[3,1,{"c":null,"d":"x"}],"b":1}',
    );
  });

  it('cùng nội dung khác thứ tự khóa cho cùng chuỗi', () => {
    expect(canonicalJson({ x: 1, y: 2 })).toBe(canonicalJson({ y: 2, x: 1 }));
  });
});

describe('sha256Hex', () => {
  it('khớp vector thử chuẩn của SHA-256', async () => {
    expect(await sha256Hex('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });
});

describe('sealChain / verifyChain (FR-PRD-05, FR-TRC-05)', () => {
  it('chuỗi niêm phong đúng thì hợp lệ, mốc đầu nối với GENESIS', async () => {
    const chain = await sealChain(PRODUCT, contents);
    expect(chain[0]?.prevHash).toBe(GENESIS);
    expect(chain[1]?.prevHash).toBe(chain[0]?.hash);
    for (const e of chain) expect(e.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(await verifyChain(PRODUCT, chain)).toEqual({ ok: true, count: contents.length });
  });

  it('hash phụ thuộc productId', async () => {
    const [a, b] = await Promise.all([
      sealChain('AAAAAAAA', contents),
      sealChain('BBBBBBBB', contents),
    ]);
    expect(a[0]?.hash).not.toBe(b[0]?.hash);
    expect(await verifyChain('BBBBBBBB', a)).toMatchObject({ ok: false, index: 0 });
  });

  it('sửa nội dung một mốc ⇒ lỗi hash tại đúng mốc đó', async () => {
    const chain = await sealChain(PRODUCT, contents);
    for (let i = 0; i < chain.length; i++) {
      const tampered: ChainEntry[] = chain.map((e, j) =>
        j === i ? { ...e, note: `${e.note} (đã sửa)` } : e,
      );
      expect(await verifyChain(PRODUCT, tampered), `sửa mốc ${i}`).toEqual({
        ok: false,
        index: i,
        reason: 'hash',
      });
    }
  });

  it('sửa ảnh minh chứng hoặc thời điểm cũng bị phát hiện', async () => {
    const chain = await sealChain(PRODUCT, contents);
    const swapped = chain.map((e, j) => (j === 2 ? { ...e, mediaChecksums: ['ff'] } : e));
    expect(await verifyChain(PRODUCT, swapped)).toMatchObject({ ok: false, index: 2 });
    const moved = chain.map((e, j) => (j === 1 ? { ...e, at: '2026-09-10T08:15:00+07:00' } : e));
    expect(await verifyChain(PRODUCT, moved)).toMatchObject({ ok: false, index: 1 });
  });

  it('sửa mốc rồi tính lại hash của chính nó vẫn bị lộ ở mốc kế tiếp (prev)', async () => {
    const chain = await sealChain(PRODUCT, contents);
    const forged = { ...chain[1], note: 'Nội dung giả' } as ChainEntry;
    forged.hash = await computeEntryHash(PRODUCT, forged);
    const tampered = chain.map((e, j) => (j === 1 ? forged : e));
    expect(await verifyChain(PRODUCT, tampered)).toEqual({ ok: false, index: 2, reason: 'prev' });
  });

  it('mốc đầu không bắt đầu bằng GENESIS, hoặc seq đứt, đều bị báo', async () => {
    const chain = await sealChain(PRODUCT, contents);
    const noGenesis = chain.map((e, j) => (j === 0 ? { ...e, prevHash: 'x' } : e));
    expect(await verifyChain(PRODUCT, noGenesis)).toEqual({ ok: false, index: 0, reason: 'prev' });
    const dropped = chain.filter((_, j) => j !== 1);
    expect(await verifyChain(PRODUCT, dropped)).toEqual({ ok: false, index: 1, reason: 'seq' });
  });
});

describe('dữ liệu minh họa', () => {
  it('nhật ký mẫu có dấu băm đầy đủ và chuỗi hợp lệ', async () => {
    const products = await getProducts();
    const withLog = products.filter((p) => p.log.length > 0);
    expect(withLog.length).toBeGreaterThan(0);
    for (const p of withLog) {
      for (const e of p.log) {
        expect(e.hash).toMatch(/^[0-9a-f]{64}$/);
        expect(e.prevHash === GENESIS || /^[0-9a-f]{64}$/.test(e.prevHash)).toBe(true);
        expect(e.mediaChecksums.every((c) => /^[0-9a-f]{64}$/.test(c))).toBe(true);
      }
      expect(await verifyChain(p.code, p.log)).toEqual({ ok: true, count: p.log.length });
    }
  });

  it('dữ liệu mẫu bị sửa một mốc thì verify báo đúng vị trí', async () => {
    const product = (await getProducts()).find((p) => p.code === 'BT7K2QXM');
    if (!product) throw new Error('thiếu dữ liệu mẫu');
    const tampered = product.log.map((e, j) =>
      j === 4 ? { ...e, note: 'Tráng men dày 2 mm.' } : e,
    );
    expect(await verifyChain(product.code, tampered)).toEqual({
      ok: false,
      index: 4,
      reason: 'hash',
    });
  });
});
