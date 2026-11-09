'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { Link, useRouter } from '@/i18n/navigation';
import {
  browserFetchSuggestions,
  type FetchSuggestions,
  SUGGESTION_GROUPS,
  type SuggestionEntry,
  suggestionEntries,
  useSuggestions,
} from './suggestions';

/** Fired on `window` to open the palette from a button elsewhere in the page (the mobile header). */
export const OPEN_PALETTE_EVENT = 'vcraft:open-palette';

export function openCommandPalette() {
  window.dispatchEvent(new Event(OPEN_PALETTE_EVENT));
}

const GROUP_LABEL = {
  products: 'groupProducts',
  households: 'groupHouseholds',
  categories: 'groupCategories',
  news: 'groupNews',
} as const;

const FOCUSABLE = 'button:not([disabled]), input:not([disabled]), a[href]';

/**
 * Command palette (FR-CAT-04): `Ctrl K` / `⌘K` anywhere, or a header button, opens a modal with an instant,
 * accent-free search over products, households, categories and news. Arrow keys move, Enter opens, Esc closes.
 * Mount it once (in the site header); it renders nothing until opened.
 */
export function CommandPalette({
  fetchSuggestions = browserFetchSuggestions,
}: {
  fetchSuggestions?: FetchSuggestions;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen((current) => !current);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener('keydown', onKey);
    window.addEventListener(OPEN_PALETTE_EVENT, onOpen);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener(OPEN_PALETTE_EVENT, onOpen);
    };
  }, []);

  return open ? (
    <PaletteDialog fetchSuggestions={fetchSuggestions} onClose={() => setOpen(false)} />
  ) : null;
}

function PaletteDialog({
  fetchSuggestions,
  onClose,
}: {
  fetchSuggestions: FetchSuggestions;
  onClose: () => void;
}) {
  const t = useTranslations('catalog');
  const locale = useLocale();
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const listId = useId();
  const hintId = useId();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const { results, failed } = useSuggestions(query, fetchSuggestions);
  const term = query.trim();

  const suggestions = suggestionEntries(results, (category) => t(`categories.${category}`), locale);
  // The last row always searches the whole catalog for what was typed.
  const viewAll: SuggestionEntry = {
    key: 'all',
    group: 'products',
    label: t('palette.viewAll', { query: term }),
    href: { pathname: '/san-pham', query: { q: term } },
  };
  const entries = term ? [...suggestions, viewAll] : [];
  const activeId = entries[active] ? `${listId}-${active}` : undefined;

  // Opens as a native modal (inert page behind it, Esc support); focus goes back where it was on close.
  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (!el.open) el.showModal();
    input.current?.focus();
    return () => {
      if (el.open) el.close();
      opener?.focus();
    };
  }, []);

  // Reset before the new rows are painted, so a late effect cannot undo an arrow-key selection.
  // biome-ignore lint/correctness/useExhaustiveDependencies: reset on a changed result set or term
  useLayoutEffect(() => setActive(0), [results, term]);

  const go = (entry: SuggestionEntry) => {
    onClose();
    router.push(entry.href);
  };

  const trapTab = (event: React.KeyboardEvent<HTMLDialogElement>) => {
    const items = [...event.currentTarget.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
      (el) => el.tabIndex >= 0,
    );
    const first = items[0];
    const last = items.at(-1);
    if (!first || !last) return;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const onInputKey = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (entries.length === 0) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActive((current) => (current + 1) % entries.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive((current) => (current - 1 + entries.length) % entries.length);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const entry = entries[active];
      if (entry) go(entry);
    }
  };

  const rows = (group: (typeof SUGGESTION_GROUPS)[number]) =>
    suggestions
      .map((entry, index) => ({ entry, index }))
      .filter(({ entry }) => entry.group === group);
  const status = failed
    ? t('suggestFailed')
    : !term
      ? t('palette.prompt')
      : suggestions.length === 0
        ? t('suggestEmpty')
        : null;
  const rowClass = (index: number) =>
    `block rounded-input px-3 py-2 text-small ${index === active ? 'bg-ink/8' : 'hover:bg-ink/6'}`;

  return (
    <dialog
      ref={dialog}
      aria-label={t('palette.title')}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          onClose();
        } else if (event.key === 'Tab') trapTab(event);
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      className="m-0 mx-auto mt-[12svh] w-[min(36rem,calc(100vw-2rem))] rounded-card bg-surface p-0 text-ink shadow-warm backdrop:bg-ink/45 backdrop:backdrop-blur-[2px]"
    >
      <div className="flex flex-col">
        <div className="flex items-center gap-2 border-ink/10 border-b p-3">
          <input
            ref={input}
            type="search"
            role="combobox"
            aria-expanded={entries.length > 0}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={activeId}
            aria-describedby={hintId}
            aria-label={t('search')}
            placeholder={t('searchPlaceholder')}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={onInputKey}
            className="min-w-0 flex-1 rounded-input border border-ink/15 bg-paper px-3 py-2"
          />
          <button
            type="button"
            onClick={onClose}
            className="rounded-input px-3 py-2 text-small text-ash hover:bg-ink/6"
          >
            {t('palette.close')}
          </button>
        </div>
        <p id={hintId} className="sr-only">
          {t('palette.hint')}
        </p>
        <div className="max-h-[60svh] overflow-y-auto p-2">
          {status ? (
            <p role="status" className="px-3 py-2 text-small text-ash">
              {status}
            </p>
          ) : null}
          <div id={listId} role="listbox" aria-label={t('palette.results')}>
            {SUGGESTION_GROUPS.map((group) => {
              const items = rows(group);
              if (items.length === 0) return null;
              return (
                // biome-ignore lint/a11y/useSemanticElements: a fieldset cannot sit inside a listbox
                <div key={group} role="group" aria-labelledby={`${listId}-${group}`}>
                  <p
                    id={`${listId}-${group}`}
                    className="px-3 pt-2 text-[0.7rem] tracking-wide text-ash uppercase"
                  >
                    {t(GROUP_LABEL[group])}
                  </p>
                  {items.map(({ entry, index }) => (
                    <div
                      key={entry.key}
                      id={`${listId}-${index}`}
                      role="option"
                      aria-selected={index === active}
                      tabIndex={-1}
                      onMouseMove={() => setActive(index)}
                    >
                      <Link
                        href={entry.href}
                        tabIndex={-1}
                        className={rowClass(index)}
                        onClick={onClose}
                      >
                        {entry.label}
                        {entry.hint ? <span className="text-ash"> · {entry.hint}</span> : null}
                      </Link>
                    </div>
                  ))}
                </div>
              );
            })}
            {entries.length > 0 ? (
              <div
                id={`${listId}-${entries.length - 1}`}
                role="option"
                aria-selected={active === entries.length - 1}
                tabIndex={-1}
                onMouseMove={() => setActive(entries.length - 1)}
              >
                <Link
                  href={viewAll.href}
                  tabIndex={-1}
                  className={`${rowClass(entries.length - 1)} mt-1 border-ink/10 border-t text-clay`}
                  onClick={onClose}
                >
                  {viewAll.label}
                </Link>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </dialog>
  );
}
