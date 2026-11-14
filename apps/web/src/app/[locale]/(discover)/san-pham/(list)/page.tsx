import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { CatalogExplorer } from '@/features/catalog/catalog-explorer';
import { parseCatalogParams, toProductFilters } from '@/features/catalog/catalog-filters';
import { CatalogHeader } from '@/features/catalog/catalog-header';
import { CATALOG_PAGE_SIZE } from '@/features/catalog/catalog-page-size';
import { fetchHouseholds, fetchProductPage } from '@/features/catalog/exhibition-api';
import { slimProductCard } from '@/features/catalog/view-models';
import { resolveLocale } from '@/lib/locale';
import { pageMetadata } from '@/lib/seo/page-metadata';

// The root layout already renders per request for the CSP nonce. Do not force-dynamic here:
// that also disables the tagged Data Cache reads below (ADR-0027, ADR-0028).

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/san-pham'>): Promise<Metadata> {
  const locale = await resolveLocale(params);
  const t = await getTranslations('indexPages.products');
  return pageMetadata({ locale, href: '/san-pham', title: t('title'), description: t('lead') });
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

  // No loading.tsx boundary on this route: first-row pictures belong in the initial document,
  // rather than a hidden streamed replacement that delays image discovery (GH#529).
  return (
    <div className="mx-auto max-w-editorial px-gutter pt-12 pb-section-tail">
      <CatalogHeader />
      <CatalogExplorer
        // Điều hướng tới URL lọc khác (vd. từ ô tìm kiếm) phải dựng lại từ dữ liệu mới của server.
        key={JSON.stringify(filters)}
        initialFilters={
          products.status === 'ok' ? { ...filters, page: products.data.page } : filters
        }
        initialItems={products.status === 'ok' ? products.data.data.map(slimProductCard) : []}
        initialTotal={products.status === 'ok' ? products.data.total : 0}
        initialTotalPages={products.status === 'ok' ? products.data.totalPages : 0}
        initialError={products.status !== 'ok'}
        households={
          households.status === 'ok'
            ? households.data.data.map(({ slug, name }) => ({ slug, name }))
            : []
        }
      />
    </div>
  );
}
