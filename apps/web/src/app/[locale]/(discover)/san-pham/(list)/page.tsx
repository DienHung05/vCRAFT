import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { CatalogExplorer } from '@/features/catalog/catalog-explorer';
import { parseCatalogParams, toProductFilters } from '@/features/catalog/catalog-filters';
import { CatalogHeader } from '@/features/catalog/catalog-header';
import { CATALOG_PAGE_SIZE } from '@/features/catalog/catalog-page-size';
import { fetchHouseholds, fetchProductPage } from '@/features/catalog/exhibition-api';
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
    fetchProductPage({
      ...toProductFilters(filters),
      limit: CATALOG_PAGE_SIZE,
      page: filters.page,
    }),
    fetchHouseholds(),
  ]);

  return (
    <div className="mx-auto max-w-editorial px-gutter pt-12 pb-block">
      <CatalogHeader />
      <CatalogExplorer
        // Điều hướng tới URL lọc khác (vd. từ ô tìm kiếm) phải dựng lại từ dữ liệu mới của server.
        key={JSON.stringify(filters)}
        initialFilters={
          products.status === 'ok' ? { ...filters, page: products.data.page } : filters
        }
        initialItems={products.status === 'ok' ? products.data.data : []}
        initialTotal={products.status === 'ok' ? products.data.total : 0}
        initialTotalPages={products.status === 'ok' ? products.data.totalPages : 0}
        initialError={products.status !== 'ok'}
        households={households.status === 'ok' ? households.data.data : []}
      />
    </div>
  );
}
