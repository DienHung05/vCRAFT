import { Badge } from '@vcraft/ui';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { PhotoCreditsNote } from '@/components/photo-credits-note';
import { ProductCard } from '@/features/catalog/product-card';
import { getProducts } from '@/lib/demo/data';
import { resolveLocale } from '@/lib/locale';

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/san-pham'>): Promise<Metadata> {
  await resolveLocale(params);
  const t = await getTranslations('indexPages.products');
  return { title: t('title'), description: t('lead') };
}

/** Danh mục sản phẩm (FR-PRD): lưới thẻ từ dữ liệu mẫu, lọc/tìm kiếm thêm khi có API. */
export default async function ProductsIndexPage({ params }: PageProps<'/[locale]/san-pham'>) {
  await resolveLocale(params);
  const [t, common, products] = await Promise.all([
    getTranslations('indexPages.products'),
    getTranslations('indexPages'),
    getProducts(),
  ]);

  return (
    <div className="mx-auto max-w-editorial px-gutter pt-12 pb-section">
      <header className="flex max-w-prose-vn flex-col gap-3">
        <Badge tone="outline" className="self-start whitespace-normal">
          {common('demoNote')}
        </Badge>
        <h1 className="text-h1">{t('title')}</h1>
        <p className="text-ash">{t('lead')}</p>
        <p className="text-small text-ash">{t('count', { count: products.length })}</p>
      </header>
      {products.length > 0 ? (
        <ul className="mt-10 grid grid-cols-2 gap-6 md:grid-cols-4">
          {products.map((p) => (
            <li key={p.slug}>
              <ProductCard product={p} heading="h2" />
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-10 text-ash">{t('empty')}</p>
      )}
      <PhotoCreditsNote />
    </div>
  );
}
