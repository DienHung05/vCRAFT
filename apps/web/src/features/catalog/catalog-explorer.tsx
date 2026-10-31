'use client';

import {
  type HouseholdSummaryDto,
  PRODUCT_SORTS,
  type ProductCardDto,
  ProductListResponseSchema,
  type ProductSort,
} from '@vcraft/contracts';
import { PRODUCT_CATEGORIES, type ProductCategory } from '@vcraft/domain';
import { Button } from '@vcraft/ui';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  type CatalogFilters,
  catalogSearchParams,
  EMPTY_FILTERS,
  toProductFilters,
} from './catalog-filters';
import { productsQueryString } from './exhibition-query';
import { ProductCard, ProductGridSkeleton } from './product-card';
import { toProductCardView } from './view-models';

const PAGE_SIZE = 24;
const TYPING_DEBOUNCE_MS = 250;

type FetchProducts = (query: string, signal: AbortSignal) => Promise<Response>;
const browserFetch: FetchProducts = (query, signal) =>
  fetch(`/api/v1/products?${query}`, { signal, headers: { accept: 'application/json' } });

export interface CatalogExplorerProps {
  initialFilters: CatalogFilters;
  initialItems: readonly ProductCardDto[];
  initialCursor: string | null;
  /** Lần tải phía server có lỗi: bắt đầu bằng trạng thái lỗi kèm thử lại. */
  initialError?: boolean;
  households: readonly HouseholdSummaryDto[];
  /** Chỉ để kiểm thử. */
  fetchProducts?: FetchProducts;
}

/**
 * Danh mục sản phẩm (FR-CAT-02, 03): bộ lọc nằm trên URL nên sao chép link ra đúng kết quả; đổi lọc
 * và tải thêm chỉ gọi JSON, không tải lại trang. Cuộn tới cuối tự tải 24 món tiếp theo, vẫn có nút
 * "Tải thêm" cho bàn phím.
 */
export function CatalogExplorer({
  initialFilters,
  initialItems,
  initialCursor,
  initialError = false,
  households,
  fetchProducts = browserFetch,
}: CatalogExplorerProps) {
  const t = useTranslations('catalog');
  const [filters, setFilters] = useState(initialFilters);
  const [items, setItems] = useState(initialItems);
  const [cursor, setCursor] = useState(initialCursor);
  const [loading, setLoading] = useState<'replace' | 'more' | null>(null);
  const [failed, setFailed] = useState(initialError);
  const abort = useRef<AbortController | null>(null);
  const sentinel = useRef<HTMLLIElement>(null);
  const typing = useRef<number | undefined>(undefined);

  const load = useCallback(
    async (next: CatalogFilters, after: string | null) => {
      abort.current?.abort();
      const controller = new AbortController();
      abort.current = controller;
      setLoading(after ? 'more' : 'replace');
      setFailed(false);
      try {
        const res = await fetchProducts(
          productsQueryString({
            ...toProductFilters(next),
            limit: PAGE_SIZE,
            ...(after ? { cursor: after } : {}),
          }),
          controller.signal,
        );
        if (!res.ok) throw new Error(String(res.status));
        const page = ProductListResponseSchema.parse(await res.json());
        setItems((current) => (after ? [...current, ...page.data] : page.data));
        setCursor(page.nextCursor);
        setLoading(null);
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setFailed(true);
        setLoading(null);
      }
    },
    [fetchProducts],
  );

  const apply = (patch: Partial<CatalogFilters>, typed = false) => {
    const next = { ...filters, ...patch };
    setFilters(next);
    const query = catalogSearchParams(next).toString();
    window.history.replaceState(null, '', query ? `?${query}` : window.location.pathname);
    window.clearTimeout(typing.current);
    if (typed) typing.current = window.setTimeout(() => void load(next, null), TYPING_DEBOUNCE_MS);
    else void load(next, null);
  };

  // Cuộn gần cuối danh sách thì tải tiếp; `rootMargin` tải trước khi người dùng chạm đáy.
  useEffect(() => {
    const target = sentinel.current;
    if (!target || !cursor || failed || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting) && !loading) {
          void load(filters, cursor);
        }
      },
      { rootMargin: '600px' },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [cursor, failed, filters, load, loading]);

  const replacing = loading === 'replace';
  const hasFilters = catalogSearchParams(filters).toString() !== '';

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

      {replacing ? (
        <ProductGridSkeleton label={t('loading')} />
      ) : items.length === 0 && !failed ? (
        <p className="text-ash">{t('empty')}</p>
      ) : (
        <ul
          aria-busy={loading === 'more'}
          data-testid="product-grid"
          className="grid grid-cols-2 gap-6 md:grid-cols-4"
        >
          {items.map((product) => (
            <li key={product.id}>
              <ProductCard product={toProductCardView(product)} heading="h2" />
            </li>
          ))}
          <li ref={sentinel} aria-hidden="true" className="col-span-full h-px" />
        </ul>
      )}

      {loading === 'more' ? <ProductGridSkeleton label={t('loading')} count={4} /> : null}

      {failed ? (
        <div role="alert" className="flex flex-col items-start gap-3">
          <p className="text-ash">{t('unavailable')}</p>
          <Button type="button" variant="secondary" onClick={() => void load(filters, cursor)}>
            {t('retry')}
          </Button>
        </div>
      ) : cursor && !loading ? (
        <Button type="button" variant="secondary" onClick={() => void load(filters, cursor)}>
          {t('loadMore')}
        </Button>
      ) : null}
    </div>
  );
}
