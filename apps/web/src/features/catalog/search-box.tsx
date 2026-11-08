'use client';

import { useTranslations } from 'next-intl';
import { useId, useState } from 'react';
import { Link, useRouter } from '@/i18n/navigation';
import {
  browserFetchSuggestions,
  type FetchSuggestions,
  SUGGESTION_GROUPS,
  suggestionEntries,
  useSuggestions,
} from './suggestions';

const GROUP_LABEL = {
  products: 'groupProducts',
  households: 'groupHouseholds',
  categories: 'groupCategories',
  news: 'groupNews',
} as const;

/**
 * Ô tìm kiếm trên đầu trang (FR-CAT-04): gợi ý tức thời không dấu cho sản phẩm, hộ, danh mục và tin;
 * Enter mở danh mục đã lọc, Esc đóng gợi ý. `Ctrl K` / `⌘K` mở bảng tìm kiếm nhanh (`CommandPalette`).
 */
export function SearchBox({
  fetchSuggestions = browserFetchSuggestions,
}: {
  fetchSuggestions?: FetchSuggestions;
}) {
  const t = useTranslations('catalog');
  const router = useRouter();
  const panelId = useId();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const { results, failed } = useSuggestions(query, fetchSuggestions);
  const entries = suggestionEntries(results, (category) => t(`categories.${category}`));

  const close = () => {
    setOpen(false);
    setQuery('');
  };
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
          type="search"
          value={query}
          aria-label={t('search')}
          aria-keyshortcuts="Control+K Meta+K"
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
          ) : entries.length === 0 ? (
            <p className="px-2 py-1.5 text-small text-ash">{t('suggestEmpty')}</p>
          ) : null}
          {SUGGESTION_GROUPS.map((group) => {
            const items = entries.filter((entry) => entry.group === group);
            if (items.length === 0) return null;
            return (
              <div key={group}>
                <p className={groupClass}>{t(GROUP_LABEL[group])}</p>
                <ul>
                  {items.map((entry) => (
                    <li key={entry.key}>
                      <Link href={entry.href} className={linkClass} onClick={close}>
                        {entry.label}
                        {entry.hint ? <span className="text-ash"> · {entry.hint}</span> : null}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      ) : null}
    </search>
  );
}
