'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { type MouseEvent, useSyncExternalStore } from 'react';
import { type PaginationSlot, paginationSlots } from './pagination-slots';

/** Products per catalog page. */
export const CATALOG_PAGE_SIZE = 12;

/** Phones get 5 cells (no siblings) so the bar plus both arrows fits 360px at 44px targets. */
const WIDE_QUERY = '(min-width: 40rem)';

function subscribeWide(onChange: () => void) {
  if (typeof window === 'undefined' || !window.matchMedia) return () => {};
  const media = window.matchMedia(WIDE_QUERY);
  media.addEventListener('change', onChange);
  return () => media.removeEventListener('change', onChange);
}

const wideSnapshot = () =>
  typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia(WIDE_QUERY).matches;

// Server and first client render use the phone layout, then the real width takes over.
const wideServerSnapshot = () => false;

const cellBase =
  'inline-flex h-11 min-w-11 items-center justify-center rounded-input px-2 text-small font-medium ' +
  'transition-[background-color,color] duration-(--duration-quick) ease-press ' +
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-glaze';
const cellIdle = 'text-ink hover:bg-ink/6';
const cellCurrent = 'bg-clay text-paper';

export interface CatalogPaginationProps {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  /** Real URL of a page, so the link also works with middle-click and without JavaScript. */
  hrefFor: (page: number) => string;
  /** Called on a plain left click instead of following the link. */
  onNavigate: (page: number) => void;
}

/**
 * Numbered pages: `‹ 1 2 … 10 11 ›`. The arrows are absent (not disabled) on the first and last page;
 * an invisible box of the same size holds their place so the numbers do not shift sideways.
 * Hidden when there is a single page or no result.
 */
export function CatalogPagination({
  page,
  totalPages,
  total,
  pageSize,
  hrefFor,
  onNavigate,
}: CatalogPaginationProps) {
  const t = useTranslations('catalog.pagination');
  const wide = useSyncExternalStore(subscribeWide, wideSnapshot, wideServerSnapshot);
  if (totalPages <= 1) return null;

  const slots = paginationSlots(page, totalPages, wide ? 7 : 5);
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  const follow = (target: number) => (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return;
    }
    event.preventDefault();
    onNavigate(target);
  };

  const arrow = (target: number, direction: 'previous' | 'next') => (
    <a
      href={hrefFor(target)}
      onClick={follow(target)}
      aria-label={t(direction)}
      rel={direction === 'previous' ? 'prev' : 'next'}
      className={`${cellBase} ${cellIdle} w-11 px-0`}
    >
      {direction === 'previous' ? (
        <ChevronLeft aria-hidden="true" className="size-5" />
      ) : (
        <ChevronRight aria-hidden="true" className="size-5" />
      )}
    </a>
  );

  const cell = (slot: PaginationSlot) => {
    if (typeof slot !== 'number') {
      return (
        <li
          key={slot}
          aria-hidden="true"
          className="inline-flex h-11 w-8 items-center justify-center text-ash"
        >
          …
        </li>
      );
    }
    return (
      <li key={slot}>
        {slot === page ? (
          <span aria-current="page" className={`${cellBase} ${cellCurrent}`}>
            {slot}
          </span>
        ) : (
          <a
            href={hrefFor(slot)}
            onClick={follow(slot)}
            aria-label={t('goTo', { page: slot })}
            className={`${cellBase} ${cellIdle}`}
          >
            {slot}
          </a>
        )}
      </li>
    );
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <nav aria-label={t('label')}>
        <ul className="flex items-center gap-0.5 sm:gap-1">
          <li className="size-11">
            {page > 1 ? (
              arrow(page - 1, 'previous')
            ) : (
              <span aria-hidden="true" className="block size-11" />
            )}
          </li>
          {slots.map(cell)}
          <li className="size-11">
            {page < totalPages ? (
              arrow(page + 1, 'next')
            ) : (
              <span aria-hidden="true" className="block size-11" />
            )}
          </li>
        </ul>
      </nav>
      <p className="text-small text-ash">{t('showing', { from, to, total })}</p>
    </div>
  );
}
