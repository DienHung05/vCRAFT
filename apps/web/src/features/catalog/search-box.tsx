'use client';

import { type SearchSuggestionsDto, SearchSuggestionsSchema } from '@vcraft/contracts';
import { useTranslations } from 'next-intl';
import { useEffect, useId, useRef, useState } from 'react';
import { Link, useRouter } from '@/i18n/navigation';

const DEBOUNCE_MS = 150;

type FetchSuggestions = (query: string, signal: AbortSignal) => Promise<Response>;
const browserFetch: FetchSuggestions = (query, signal) =>
  fetch(`/api/v1/search/suggest?q=${encodeURIComponent(query)}`, { signal });

const NO_RESULTS: SearchSuggestionsDto = { products: [], households: [], news: [] };

/**
 * Ô tìm kiếm trên đầu trang (FR-CAT-04): gợi ý tức thời không dấu cho sản phẩm, hộ và tin; `Ctrl K`
 * / `⌘K` đưa con trỏ vào ô, Enter mở danh mục đã lọc, Esc đóng gợi ý.
 */
export function SearchBox({
  fetchSuggestions = browserFetch,
}: {
  fetchSuggestions?: FetchSuggestions;
}) {
  const t = useTranslations('catalog');
  const router = useRouter();
  const panelId = useId();
  const input = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [failed, setFailed] = useState(false);
  const [results, setResults] = useState(NO_RESULTS);

  useEffect(() => {
    const focus = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        input.current?.focus();
      }
    };
    window.addEventListener('keydown', focus);
    return () => window.removeEventListener('keydown', focus);
  }, []);

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
        setResults(SearchSuggestionsSchema.parse(await res.json()));
        setFailed(false);
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setFailed(true);
      }
    }, DEBOUNCE_MS);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query, fetchSuggestions]);

  const close = () => {
    setOpen(false);
    setQuery('');
  };
  const empty =
    results.products.length === 0 && results.households.length === 0 && results.news.length === 0;
  const linkClass = 'block rounded-input px-2 py-1.5 text-small hover:bg-ink/6';
  const groupClass = 'px-2 pt-2 text-[0.7rem] tracking-wide text-ash uppercase';

  return (
    <search
      className="relative"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const term = query.trim();
          if (!term) return;
          close();
          router.push({ pathname: '/san-pham', query: { q: term } });
        }}
      >
        <input
          ref={input}
          type="search"
          value={query}
          aria-label={t('search')}
          placeholder={t('searchPlaceholder')}
          className="w-full rounded-input border border-ink/15 bg-surface px-3 py-1.5 text-small lg:w-44 xl:w-56"
          onFocus={() => setOpen(true)}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Escape') setOpen(false);
          }}
        />
      </form>
      {open && query.trim() ? (
        <div
          id={panelId}
          aria-live="polite"
          className="absolute right-0 z-50 mt-2 max-h-[70svh] w-72 overflow-y-auto rounded-card bg-surface p-2 shadow-warm ring-1 ring-ink/8"
        >
          {failed ? (
            <p className="px-2 py-1.5 text-small text-ash">{t('suggestFailed')}</p>
          ) : empty ? (
            <p className="px-2 py-1.5 text-small text-ash">{t('suggestEmpty')}</p>
          ) : null}
          {results.products.length > 0 ? (
            <>
              <p className={groupClass}>{t('groupProducts')}</p>
              <ul>
                {results.products.map((p) => (
                  <li key={p.slug}>
                    <Link
                      href={{ pathname: '/san-pham/[slug]', params: { slug: p.slug } }}
                      className={linkClass}
                      onClick={close}
                    >
                      {p.name} <span className="text-ash">· {p.household}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
          {results.households.length > 0 ? (
            <>
              <p className={groupClass}>{t('groupHouseholds')}</p>
              <ul>
                {results.households.map((h) => (
                  <li key={h.slug}>
                    <Link
                      href={{ pathname: '/nghe-nhan/[slug]', params: { slug: h.slug } }}
                      className={linkClass}
                      onClick={close}
                    >
                      {h.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
          {results.news.length > 0 ? (
            <>
              <p className={groupClass}>{t('groupNews')}</p>
              <ul>
                {results.news.map((n) => (
                  <li key={n.slug}>
                    <Link href="/tin-tuc" className={linkClass} onClick={close}>
                      {n.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </div>
      ) : null}
    </search>
  );
}
