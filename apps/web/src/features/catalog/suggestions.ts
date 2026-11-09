'use client';

import type { SearchSuggestionsDto } from '@vcraft/contracts';
import { PRODUCT_CATEGORIES, type ProductCategory } from '@vcraft/domain';
import { useEffect, useState } from 'react';
import { textFor } from '@/lib/localized-text';

/** Pause after the last keystroke before asking the API (FR-CAT-04: suggestions within 300 ms). */
export const SUGGEST_DEBOUNCE_MS = 120;

export type FetchSuggestions = (query: string, signal: AbortSignal) => Promise<Response>;
export const browserFetchSuggestions: FetchSuggestions = (query, signal) =>
  fetch(`/api/v1/search/suggest?q=${encodeURIComponent(query)}`, { signal });

export const NO_RESULTS: SearchSuggestionsDto = {
  products: [],
  households: [],
  categories: [],
  news: [],
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;
const everyItem = (value: unknown, keys: readonly string[]) =>
  Array.isArray(value) &&
  value.every((v) => isRecord(v) && keys.every((k) => typeof v[k] === 'string'));
const isCategory = (value: unknown): value is ProductCategory =>
  PRODUCT_CATEGORIES.includes(value as ProductCategory);

/**
 * Checks the shape of `GET /search/suggest` by hand: the contract's zod schema would put zod (~40KB
 * gzipped) on the critical path of every public page, since the search box lives in the header.
 * `categories` may be missing in an answer cached before the field existed; that reads as none.
 */
export function parseSuggestions(value: unknown): SearchSuggestionsDto {
  if (
    !isRecord(value) ||
    !everyItem(value.products, ['name', 'slug', 'household']) ||
    !everyItem(value.households, ['name', 'slug']) ||
    !everyItem(value.news, ['title', 'slug'])
  ) {
    throw new Error('Unexpected search suggestions payload');
  }
  const categories = Array.isArray(value.categories)
    ? value.categories.filter((c) => isRecord(c) && isCategory(c.category))
    : [];
  return { ...(value as unknown as SearchSuggestionsDto), categories };
}

/**
 * Suggestions for `query`: waits {@link SUGGEST_DEBOUNCE_MS} after the last change, then asks the API and
 * aborts the request as soon as the query changes again, so a slow answer never overwrites a newer one.
 */
export function useSuggestions(query: string, fetchSuggestions: FetchSuggestions) {
  const [results, setResults] = useState(NO_RESULTS);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const term = query.trim();
    if (!term) {
      setResults(NO_RESULTS);
      setFailed(false);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const res = await fetchSuggestions(term, controller.signal);
        if (!res.ok) throw new Error(String(res.status));
        const parsed = parseSuggestions(await res.json());
        if (controller.signal.aborted) return;
        setResults(parsed);
        setFailed(false);
      } catch (error) {
        if (controller.signal.aborted) return;
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setFailed(true);
      }
    }, SUGGEST_DEBOUNCE_MS);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query, fetchSuggestions]);

  return { results, failed };
}

export type SuggestionGroup = 'products' | 'households' | 'categories' | 'news';
export const SUGGESTION_GROUPS: readonly SuggestionGroup[] = [
  'products',
  'households',
  'categories',
  'news',
];

/** Where an entry leads: the page of the thing itself, or the catalog filtered to it. */
export type SuggestionHref =
  | {
      pathname: '/san-pham/[slug]' | '/nghe-nhan/[slug]' | '/tin-tuc/[slug]';
      params: { slug: string };
    }
  | { pathname: '/san-pham'; query: { category: ProductCategory } | { q: string } };

export interface SuggestionEntry {
  key: string;
  group: SuggestionGroup;
  label: string;
  /** Secondary text, e.g. the household that makes a product. */
  hint?: string;
  href: SuggestionHref;
}

/** The suggestions as one flat list in display order; each links to the page of the thing itself. */
export function suggestionEntries(
  results: SearchSuggestionsDto,
  categoryLabel: (category: ProductCategory) => string,
  locale = 'vi',
): SuggestionEntry[] {
  return [
    ...results.products.map(
      (p): SuggestionEntry => ({
        key: `products:${p.slug}`,
        group: 'products',
        label: textFor(locale, p.name, p.nameEn),
        hint: p.household,
        href: { pathname: '/san-pham/[slug]', params: { slug: p.slug } },
      }),
    ),
    ...results.households.map(
      (h): SuggestionEntry => ({
        key: `households:${h.slug}`,
        group: 'households',
        label: h.name,
        href: { pathname: '/nghe-nhan/[slug]', params: { slug: h.slug } },
      }),
    ),
    ...results.categories.map(
      (c): SuggestionEntry => ({
        key: `categories:${c.category}`,
        group: 'categories',
        label: categoryLabel(c.category),
        href: { pathname: '/san-pham', query: { category: c.category } },
      }),
    ),
    ...results.news.map(
      (n): SuggestionEntry => ({
        key: `news:${n.slug}`,
        group: 'news',
        label: n.title,
        href: { pathname: '/tin-tuc/[slug]', params: { slug: n.slug } },
      }),
    ),
  ];
}
