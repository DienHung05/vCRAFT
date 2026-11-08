'use client';

import type { HouseholdSummaryDto, ProductCardDto } from '@vcraft/contracts';
import {
  PRODUCT_CATEGORIES,
  PRODUCT_SORTS,
  type ProductCategory,
  type ProductSort,
} from '@vcraft/domain';
import { Button, buttonVariants } from '@vcraft/ui';
import { useLocale, useTranslations } from 'next-intl';
import { useCallback, useEffect, useRef, useState } from 'react';
import { EmptyState } from '@/components/states/empty-state';
import { ErrorState } from '@/components/states/error-state';
import { Link } from '@/i18n/navigation';
import {
  type CatalogFilters,
  catalogSearchParams,
  EMPTY_FILTERS,
  parseCatalogParams,
  toProductFilters,
} from './catalog-filters';
import { CATALOG_PAGE_SIZE } from './catalog-page-size';
import { CatalogPagination } from './catalog-pagination';
import { productsQueryString } from './exhibition-query';
import { ProductCard, ProductGridSkeleton } from './product-card';
import { toProductCardView } from './view-models';

const PAGE_SIZE = CATALOG_PAGE_SIZE;
const TYPING_DEBOUNCE_MS = 250;
/** Cards in the first viewport (one row on desktop, two on mobile): their pictures load eagerly. */
const EAGER_CARD_COUNT = 4;

type FetchProducts = (query: string, signal: AbortSignal) => Promise<Response>;
const browserFetch: FetchProducts = (query, signal) =>
  fetch(`/api/v1/products?${query}`, { signal, headers: { accept: 'application/json' } });

export interface CatalogExplorerProps {
  initialFilters: CatalogFilters;
  initialItems: readonly ProductCardDto[];
  initialTotal: number;
  initialTotalPages: number;
  /** Lần tải phía server có lỗi: bắt đầu bằng trạng thái lỗi kèm thử lại. */
  initialError?: boolean;
  households: readonly HouseholdSummaryDto[];
  /** Chỉ để kiểm thử. */
  fetchProducts?: FetchProducts;
}

/**
 * Danh mục sản phẩm (FR-CAT-02, 03): bộ lọc và trang nằm trên URL nên sao chép link ra đúng kết quả;
 * đổi lọc và chuyển trang chỉ gọi JSON, không tải lại trang. Phân trang đánh số 12 món mỗi trang.
 */
export function CatalogExplorer({
  initialFilters,
  initialItems,
  initialTotal,
  initialTotalPages,
  initialError = false,
  households,
  fetchProducts = browserFetch,
}: CatalogExplorerProps) {
  const locale = useLocale();
  const t = useTranslations('catalog');
  const nav = useTranslations('nav');
  const [filters, setFilters] = useState(initialFilters);
  const [items, setItems] = useState(initialItems);
  const [total, setTotal] = useState(initialTotal);
  const [totalPages, setTotalPages] = useState(initialTotalPages);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(initialError);
  const abort = useRef<AbortController | null>(null);
  const typing = useRef<number | undefined>(undefined);
  const regionRef = useRef<HTMLElement>(null);

  const load = useCallback(
    async (next: CatalogFilters) => {
      abort.current?.abort();
      const controller = new AbortController();
      abort.current = controller;
      setLoading(true);
      setFailed(false);
      try {
        const res = await fetchProducts(
          productsQueryString({
            ...toProductFilters(next),
            limit: PAGE_SIZE,
          }),
          controller.signal,
        );
        if (!res.ok) throw new Error(String(res.status));
        // The schema (zod) loads on the first filter or page change, not with the page's first-load JS.
        const { ProductPageResponseSchema } = await import('@vcraft/contracts');
        const pageData = ProductPageResponseSchema.parse(await res.json());
        setItems(pageData.data);
        setTotal(pageData.total);
        setTotalPages(pageData.totalPages);
        // The API answers a page past the end with the last page: follow it so the bar and URL agree.
        if (pageData.page !== next.page) {
          setFilters((current) => ({ ...current, page: pageData.page }));
          const query = catalogSearchParams({ ...next, page: pageData.page }).toString();
          window.history.replaceState(null, '', query ? `?${query}` : window.location.pathname);
        }
        setLoading(false);
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setFailed(true);
        setLoading(false);
      }
    },
    [fetchProducts],
  );

  const apply = (patch: Partial<CatalogFilters>, typed = false) => {
    // Changing any filter resets to page 1
    const resetPage = !('page' in patch);
    const next = { ...filters, ...patch, ...(resetPage && { page: 1 }) };
    setFilters(next);
    const query = catalogSearchParams(next).toString();
    window.history.replaceState(null, '', query ? `?${query}` : window.location.pathname);
    window.clearTimeout(typing.current);
    if (typed) typing.current = window.setTimeout(() => void load(next), TYPING_DEBOUNCE_MS);
    else void load(next);
  };

  const changePage = (page: number) => {
    const next = { ...filters, page };
    setFilters(next);
    const query = catalogSearchParams(next).toString();
    // pushState (unlike filter typing) so the Back button returns to the previous page.
    window.history.pushState(null, '', query ? `?${query}` : window.location.pathname);
    window.clearTimeout(typing.current);
    void load(next);
    const region = regionRef.current;
    if (region) {
      const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
      // scrollIntoView is absent in jsdom and some test environments; guard so the call is a no-op there.
      region.scrollIntoView?.({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
      region.focus({ preventScroll: true });
    }
  };

  // Back/forward after pushState: rebuild the filters and the page from the URL.
  useEffect(() => {
    const onPopState = () => {
      const next = parseCatalogParams(
        Object.fromEntries(new URLSearchParams(window.location.search)),
      );
      window.clearTimeout(typing.current);
      setFilters(next);
      void load(next);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [load]);

  const hasFilters =
    catalogSearchParams({ ...filters, page: 1 }).toString() !==
    catalogSearchParams({ ...EMPTY_FILTERS, page: 1 }).toString();

  return (
    <div className="mt-8 flex flex-col gap-8">
      <form
        aria-label={t('filtersLabel')}
        className="flex flex-wrap items-end gap-x-5 gap-y-4"
        onSubmit={(event) => event.preventDefault()}
      >
        <label className="flex flex-col gap-1 text-small">
          {t('search')}
          <input
            type="search"
            value={filters.q}
            placeholder={t('searchPlaceholder')}
            onChange={(event) => apply({ q: event.target.value }, true)}
            className="w-56 rounded-input border border-ink/20 bg-surface px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-small">
          {t('category')}
          <select
            value={filters.category}
            onChange={(event) => apply({ category: event.target.value as ProductCategory | '' })}
            className="rounded-input border border-ink/20 bg-surface px-2 py-2"
          >
            <option value="">{t('allCategories')}</option>
            {PRODUCT_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {t(`categories.${category}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-small">
          {t('household')}
          <select
            value={filters.household}
            onChange={(event) => apply({ household: event.target.value })}
            className="max-w-48 rounded-input border border-ink/20 bg-surface px-2 py-2"
          >
            <option value="">{t('allHouseholds')}</option>
            {households.map((h) => (
              <option key={h.slug} value={h.slug}>
                {h.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-small">
          {t('minPrice')}
          <input
            type="number"
            min={0}
            step={50_000}
            inputMode="numeric"
            value={filters.minPrice}
            onChange={(event) => apply({ minPrice: event.target.value }, true)}
            className="w-32 rounded-input border border-ink/20 bg-surface px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-small">
          {t('maxPrice')}
          <input
            type="number"
            min={0}
            step={50_000}
            inputMode="numeric"
            value={filters.maxPrice}
            onChange={(event) => apply({ maxPrice: event.target.value }, true)}
            className="w-32 rounded-input border border-ink/20 bg-surface px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-small">
          {t('sort')}
          <select
            value={filters.sort}
            onChange={(event) => apply({ sort: event.target.value as ProductSort })}
            className="rounded-input border border-ink/20 bg-surface px-2 py-2"
          >
            {PRODUCT_SORTS.map((sort) => (
              <option key={sort} value={sort}>
                {t(`sorts.${sort}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 py-2 text-small">
          <input
            type="checkbox"
            checked={filters.oneOfAKind}
            onChange={(event) => apply({ oneOfAKind: event.target.checked })}
          />
          {t('oneOfAKind')}
        </label>
        <label className="flex items-center gap-2 py-2 text-small">
          <input
            type="checkbox"
            checked={filters.inStock}
            onChange={(event) => apply({ inStock: event.target.checked })}
          />
          {t('inStock')}
        </label>
        <label className="flex items-center gap-2 py-2 text-small">
          <input
            type="checkbox"
            checked={filters.openWorkshop}
            onChange={(event) => apply({ openWorkshop: event.target.checked })}
          />
          {t('openWorkshop')}
        </label>
        {hasFilters ? (
          <button
            type="button"
            className="py-2 text-small text-clay underline underline-offset-4"
            onClick={() => apply(EMPTY_FILTERS)}
          >
            {t('clear')}
          </button>
        ) : null}
      </form>

      <section
        ref={regionRef as React.Ref<HTMLElement>}
        tabIndex={-1}
        aria-label={t('results')}
        aria-busy={loading}
        className="flex scroll-mt-24 flex-col gap-8 outline-none"
      >
        {loading ? (
          <ProductGridSkeleton label={t('loading')} count={PAGE_SIZE} />
        ) : items.length === 0 && !failed ? (
          <EmptyState
            illustration="magnifier"
            title={t('empty')}
            description={hasFilters ? t('emptyHint') : undefined}
            action={
              hasFilters ? (
                <Button type="button" variant="secondary" onClick={() => apply(EMPTY_FILTERS)}>
                  {t('clear')}
                </Button>
              ) : (
                <Link href="/nghe-nhan" className={buttonVariants({ variant: 'secondary' })}>
                  {nav('artisans')}
                </Link>
              )
            }
          />
        ) : (
          <ul data-testid="product-grid" className="grid grid-cols-2 gap-6 md:grid-cols-4">
            {items.map((product, index) => (
              <li key={product.id}>
                <ProductCard
                  product={toProductCardView(product, locale)}
                  heading="h2"
                  priority={index < EAGER_CARD_COUNT}
                />
              </li>
            ))}
          </ul>
        )}

        {failed ? (
          <ErrorState message={t('unavailable')} onRetry={() => void load(filters)} />
        ) : loading ? null : (
          <CatalogPagination
            page={filters.page}
            totalPages={totalPages}
            total={total}
            pageSize={PAGE_SIZE}
            hrefFor={(p) => `?${catalogSearchParams({ ...filters, page: p }).toString()}`}
            onNavigate={changePage}
          />
        )}
      </section>
    </div>
  );
}
