'use client';

import { useTranslations } from 'next-intl';
import { openCommandPalette } from './command-palette';

/** Header button that opens the command palette; for screens below `md`, where there is no search box. */
export function SearchPaletteButton({ className }: { className?: string }) {
  const t = useTranslations('catalog');
  return (
    <button
      type="button"
      aria-label={t('palette.open')}
      aria-haspopup="dialog"
      aria-keyshortcuts="Control+K Meta+K"
      onClick={openCommandPalette}
      className={`inline-flex size-9 items-center justify-center rounded-input text-ink hover:bg-ink/6 focus-visible:outline-2 focus-visible:outline-glaze ${className ?? ''}`}
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="size-5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
      </svg>
    </button>
  );
}
