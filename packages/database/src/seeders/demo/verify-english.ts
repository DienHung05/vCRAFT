import type { EntityManager } from '@mikro-orm/core';
import { Product } from '../../entities/index.js';
import { DEMO_HOUSEHOLD_IDS } from './accounts.js';

type AddCheck = (name: string, ok: boolean, detail: string) => void;

type EnglishFields = Pick<Product, 'traceCode' | 'nameEn' | 'descriptionEn'>;

const hasText = (value: string | null | undefined): boolean => (value ?? '').trim() !== '';

/**
 * English product text of the demo data (GH#482): the products of Lò Đức Phát and every published product (the
 * home page features published ones) carry an English name and description, so `/en` pages do not show
 * Vietnamese product text. Read-only.
 */
export async function verifyEnglishProducts(em: EntityManager, add: AddCheck): Promise<void> {
  const fields = ['traceCode', 'nameEn', 'descriptionEn'] as const;
  const phat = await em.find(
    Product,
    { household: DEMO_HOUSEHOLD_IDS.household },
    { fields: [...fields] },
  );
  const published = await em.find(Product, { status: 'PUBLISHED' }, { fields: [...fields] });
  const lacking = (products: readonly EnglishFields[]) =>
    products.filter((p) => !hasText(p.nameEn) || !hasText(p.descriptionEn));

  const phatLacking = lacking(phat);
  add(
    'Lò Đức Phát: mọi sản phẩm có nameEn và descriptionEn',
    phat.length > 0 && phatLacking.length === 0,
    phatLacking.length === 0
      ? `${phat.length} sản phẩm`
      : `thiếu ở ${phatLacking
          .slice(0, 5)
          .map((p) => p.traceCode)
          .join(', ')}`,
  );

  const publishedLacking = lacking(published);
  add(
    'Sản phẩm đã xuất bản (gồm sản phẩm nổi bật trang chủ): có nameEn và descriptionEn',
    published.length > 0 && publishedLacking.length === 0,
    publishedLacking.length === 0
      ? `${published.length} sản phẩm`
      : `thiếu ${publishedLacking.length}/${published.length}, vd ${publishedLacking
          .slice(0, 5)
          .map((p) => p.traceCode)
          .join(', ')}`,
  );
}
