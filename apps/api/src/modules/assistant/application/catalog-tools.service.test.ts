import type { MikroORM } from '@mikro-orm/core';
import { Household, Product } from '@vcraft/database';
import { describe, expect, it } from 'vitest';
import { CatalogToolsService } from './catalog-tools.service';

const household = { name: 'Gốm Bích Hợp', slug: 'gom-bich-hop', village: 'Bát Tràng' };
const product = {
  name: 'Chén tống men lam',
  slug: 'chen-tong-men-lam-a22a7wac',
  traceCode: 'A22A7WAC',
  category: 'TABLEWARE',
  household,
};

/** Just enough of MikroORM: `findOne` answers by entity class and records the filter it was given. */
function service() {
  const queries: { entity: unknown; where: Record<string, unknown> }[] = [];
  const em = {
    findOne: async (entity: unknown, where: Record<string, unknown>) => {
      queries.push({ entity, where });
      if (entity === Product)
        return where.slug === product.slug || where.traceCode === product.traceCode
          ? product
          : null;
      return where.slug === household.slug ? household : null;
    },
  };
  const orm = { em: { fork: () => em } } as unknown as MikroORM;
  return { queries, tools: new CatalogToolsService(orm) };
}

describe('CatalogToolsService.pageContext (GH#233)', () => {
  it('names the household behind a product page, in both locales', async () => {
    const { tools } = service();
    expect(await tools.pageContext('/vi/san-pham/chen-tong-men-lam-a22a7wac', 'vi')).toBe(
      'This page is the product "Chén tống men lam" (category TABLEWARE), made by the household "Gốm Bích Hợp", village Bát Tràng: /vi/nghe-nhan/gom-bich-hop.',
    );
    expect(await tools.pageContext('/en/products/chen-tong-men-lam-a22a7wac', 'en')).toContain(
      '/en/artisans/gom-bich-hop',
    );
  });

  it('resolves a trace page by its code and a household page by its slug', async () => {
    const { tools } = service();
    expect(await tools.pageContext('/vi/truy-xuat/a22a7wac', 'vi')).toContain('"Gốm Bích Hợp"');
    expect(await tools.pageContext('/en/artisans/gom-bich-hop?ref=map', 'en')).toBe(
      'This page is the household "Gốm Bích Hợp" in the village Bát Tràng.',
    );
  });

  it('only looks at published products of approved households', async () => {
    const { tools, queries } = service();
    await tools.pageContext('/vi/san-pham/chen-tong-men-lam-a22a7wac', 'vi');
    expect(queries[0]?.where).toMatchObject({
      status: 'PUBLISHED',
      household: { status: 'APPROVED' },
    });
    await tools.pageContext('/vi/nghe-nhan/gom-bich-hop', 'vi');
    expect(queries[1]).toMatchObject({ entity: Household, where: { status: 'APPROVED' } });
  });

  it('gives null for an unknown record or any other path, without touching the database', async () => {
    const { tools, queries } = service();
    expect(await tools.pageContext('/vi/san-pham/khong-co', 'vi')).toBeNull();
    expect(queries).toHaveLength(1);
    for (const path of ['/vi', '/vi/san-pham', '/vi/ban-do', '/vi/studio/san-pham/abc'])
      expect(await tools.pageContext(path, 'vi')).toBeNull();
    expect(queries).toHaveLength(1);
  });
});
