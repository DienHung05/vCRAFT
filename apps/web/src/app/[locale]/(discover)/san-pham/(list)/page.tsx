import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { CatalogExplorer } from '@/features/catalog/catalog-explorer';
import { parseCatalogParams, toProductFilters } from '@/features/catalog/catalog-filters';
import { CatalogHeader } from '@/features/catalog/catalog-header';
import { CATALOG_PAGE_SIZE } from '@/features/catalog/catalog-page-size';
import { preloadCardCovers } from '@/features/catalog/cover-preload';
import { fetchHouseholds, fetchProductPage } from '@/features/catalog/exhibition-api';
import { slimProductCard, toProductCardView } from '@/features/catalog/view-models';
import { resolveLocale } from '@/lib/locale';
import { pageMetadata } from '@/lib/seo/page-metadata';

// No loading.tsx next to this page on purpose (GH#529, ADR-0028): a loading boundary streams the grid,
// and the LCP picture then arrives in a hidden chunk. The reads are cached (ADR-0027), so waiting is short.
// Danh mục lấy từ API theo bộ lọc trên URL, không dựng tĩnh lúc build.
export const dynamic = 'force-dynamic';

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
  const locale = await resolveLocale(params);
  const filters = parseCatalogParams(await searchParams);
  const [products, households] = await Promise.all([
    fetchProductPage({
      ...toProductFilters(filters),
      limit: CATALOG_PAGE_SIZE,
      page: filters.page,
    }),
    fetchHouseholds(),
  ]);

  const initialItems = products.status === 'ok' ? products.data.data.map(slimProductCard) : [];
  // GH#529: there is no loading.tsx on this route, so the first row is in the first HTML flush; the
  // preload also puts the covers in the <head>, ahead of the body's <img> tags.
  preloadCardCovers(initialItems.map((item) => toProductCardView(item, locale)));

  return (
    <div className="mx-auto max-w-editorial px-gutter pt-12 pb-section-tail">
      <CatalogHeader />
      <CatalogExplorer
        // Điều hướng tới URL lọc khác (vd. từ ô tìm kiếm) phải dựng lại từ dữ liệu mới của server.
        key={JSON.stringify(filters)}
        initialFilters={
          products.status === 'ok' ? { ...filters, page: products.data.page } : filters
        }
        initialItems={initialItems}
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
