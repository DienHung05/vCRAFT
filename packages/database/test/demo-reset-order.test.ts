import { MikroORM, type Options } from '@mikro-orm/core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createMikroOrmOptions } from '../src/mikro-orm.config.js';
import { CLEARED_ENTITIES } from '../src/seeders/demo/reset.js';

/**
 * Chống lệch giữa `CLEARED_ENTITIES` (reset.ts) và lược đồ thật: bảng mới có khóa ngoại tới một bảng nghiệp vụ
 * mà không vào danh sách xóa sẽ làm `demo:reset` vỡ khóa ngoại trên CSDL thật. Chỉ đọc metadata, không mở kết nối (MikroORM kết nối lười, test không chạy truy vấn nào).
 */

/** Thực thể không bị xóa nhưng có khóa ngoại tới bảng bị xóa: được phép vì khóa ngoại tự gỡ (SET NULL / CASCADE). */
const SAFE_FK_ENTITIES: Readonly<Record<string, string>> = {
  // unapplied_payment.payment_id nullable -> ON DELETE SET NULL
  UnappliedPayment: 'set null',
};

interface Reference {
  readonly owner: string;
  readonly target: string;
  readonly property: string;
  readonly nullable: boolean;
  readonly deleteRule: string | undefined;
}

describe('CLEARED_ENTITIES (demo:reset)', () => {
  let orm: MikroORM;
  let references: Reference[];

  beforeAll(async () => {
    orm = await MikroORM.init(
      createMikroOrmOptions({ DB_DRIVER: 'postgresql' }) as unknown as Options,
    );
    references = [];
    for (const meta of orm.getMetadata().getAll().values()) {
      for (const prop of Object.values(meta.properties ?? {})) {
        const owning = (prop.kind === 'm:1' || (prop.kind === '1:1' && prop.owner)) as boolean;
        const target = prop.targetMeta?.className;
        if (!owning || !target) continue;
        references.push({
          owner: meta.className,
          target,
          property: prop.name,
          nullable: Boolean(prop.nullable),
          deleteRule: prop.deleteRule,
        });
      }
    }
  });

  afterAll(async () => {
    await orm.close(true);
  });

  const cleared = () => CLEARED_ENTITIES.map((entity) => entity.name);

  it('không có thực thể trùng lặp', () => {
    expect(new Set(cleared()).size).toBe(CLEARED_ENTITIES.length);
  });

  it('đọc được các khóa ngoại từ metadata', () => {
    expect(references.length).toBeGreaterThan(10);
    expect(references).toContainEqual(
      expect.objectContaining({ owner: 'ProductFavourite', target: 'Product' }),
    );
  });

  it('mọi thực thể tham chiếu một bảng bị xóa đều bị xóa theo, hoặc nằm trong danh sách cho phép', () => {
    const list = new Set(cleared());
    const missing = references
      .filter(
        (ref) => list.has(ref.target) && !list.has(ref.owner) && !(ref.owner in SAFE_FK_ENTITIES),
      )
      .map((ref) => `${ref.owner}.${ref.property} -> ${ref.target}`);
    expect(missing, `Thêm vào CLEARED_ENTITIES (reset.ts) trước ${missing.join(', ')}`).toEqual([]);
  });

  it('thực thể trong danh sách cho phép thật sự có khóa ngoại tự gỡ (nullable hoặc cascade/set null)', () => {
    const list = new Set(cleared());
    for (const name of Object.keys(SAFE_FK_ENTITIES)) {
      expect(list.has(name), `${name} đã bị xóa rồi, bỏ khỏi SAFE_FK_ENTITIES`).toBe(false);
      const toCleared = references.filter((ref) => ref.owner === name && list.has(ref.target));
      expect(toCleared.length).toBeGreaterThan(0);
      for (const ref of toCleared) {
        expect(ref.nullable || ref.deleteRule === 'cascade' || ref.deleteRule === 'set null').toBe(
          true,
        );
      }
    }
  });

  it('mỗi thực thể đứng trước mọi thực thể mà nó tham chiếu (con trước cha)', () => {
    const order = cleared();
    const wrong = references
      .filter(
        (ref) =>
          ref.owner !== ref.target && order.includes(ref.owner) && order.includes(ref.target),
      )
      .filter((ref) => order.indexOf(ref.owner) > order.indexOf(ref.target))
      .map((ref) => `${ref.owner} phải đứng trước ${ref.target}`);
    expect(wrong).toEqual([]);
  });
});
