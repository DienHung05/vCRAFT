import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { PhotoCreditsNote } from '@/components/photo-credits-note';
import { CatalogExplorer } from '@/features/catalog/catalog-explorer';
import { parseCatalogParams, toProductFilters } from '@/features/catalog/catalog-filters';
import { CatalogHeader } from '@/features/catalog/catalog-header';
import { fetchHouseholds, fetchProducts } from '@/features/catalog/exhibition-api';
import { resolveLocale } from '@/lib/locale';

// Danh mục lấy từ API theo bộ lọc trên URL, không dựng tĩnh lúc build.
export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/san-pham'>): Promise<Metadata> {
  await resolveLocale(params);
  const t = await getTranslations('indexPages.products');
  return { title: t('title'), description: t('lead') };
}

/** Danh mục sản phẩm (FR-CAT-01 … 03): trang đầu dựng phía server theo URL, sau đó tải bằng JSON. */
export default async function ProductsIndexPage({
  params,
  searchParams,
}: PageProps<'/[locale]/san-pham'>) {
  await resolveLocale(params);
  const filters = parseCatalogParams(await searchParams);
  const [products, households] = await Promise.all([
    fetchProducts({ ...toProductFilters(filters), limit: 24 }),
    fetchHouseholds(),
  ]);

  return (
    <div className="mx-auto max-w-editorial px-gutter pt-12 pb-section">
      <CatalogHeader />
      <CatalogExplorer
        // Điều hướng tới URL lọc khác (vd. từ ô tìm kiếm) phải dựng lại từ dữ liệu mới của server.
        key={JSON.stringify(filters)}
        initialFilters={filters}
        initialItems={products.status === 'ok' ? products.data.data : []}
        initialCursor={products.status === 'ok' ? products.data.nextCursor : null}
        initialError={products.status !== 'ok'}
        households={households.status === 'ok' ? households.data.data : []}
      />
      <PhotoCreditsNote />
    </div>
  );
}
