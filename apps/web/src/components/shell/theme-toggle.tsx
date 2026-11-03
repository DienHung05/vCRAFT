'use client';

import { useTranslations } from 'next-intl';
import { useSyncExternalStore } from 'react';
import { effectiveTheme, oppositeTheme, parseTheme, storeTheme, type Theme } from '@/lib/theme';

const DARK_QUERY = '(prefers-color-scheme: dark)';

/** Re-reads the theme when the OS preference or `<html data-theme>` changes. */
function subscribe(onChange: () => void) {
  const media = matchMedia(DARK_QUERY);
  media.addEventListener('change', onChange);
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  return () => {
    media.removeEventListener('change', onChange);
    observer.disconnect();
  };
}

function currentTheme(): Theme {
  return effectiveTheme(
    parseTheme(document.documentElement.dataset.theme),
    matchMedia(DARK_QUERY).matches,
  );
}

function applyTheme(next: Theme) {
  const swap = () => {
    document.documentElement.dataset.theme = next;
  };
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  // Same-document View Transition cross-fades the palettes (BRAND §6); plain swap where unsupported.
  if (!reduced && typeof document.startViewTransition === 'function')
    document.startViewTransition(swap);
  else swap();
  storeTheme(next);
}

/**
 * Light ⇄ dark switch in the site header. The first click flips away from the theme on screen.
 * Drawn at 36px like the search toggle so the lg header row still fits 1024px; `after:-inset-1` keeps a 44px hit target.
 */
export function ThemeToggle() {
  const t = useTranslations('nav');
  // Unknown on the server; the generic label is replaced right after hydration.
  const theme = useSyncExternalStore<Theme | null>(subscribe, currentTheme, () => null);
  const target = theme ? oppositeTheme(theme) : null;
  const label =
    target === 'dark' ? t('themeToDark') : target === 'light' ? t('themeToLight') : t('theme');

  return (
    <button
      type="button"
      onClick={() => applyTheme(oppositeTheme(currentTheme()))}
      aria-label={label}
      title={label}
      className="relative inline-flex size-9 shrink-0 items-center justify-center rounded-chip text-ash transition-colors hover:bg-ink/6 hover:text-ink focus-visible:outline-2 focus-visible:outline-glaze focus-visible:outline-offset-2 after:absolute after:-inset-1 after:content-['']"
    >
      <ContrastIcon />
    </button>
  );
}

/** Outer circle split dark/light, inner circle with the halves inverted. Colours follow the theme. */
function ContrastIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5">
      <circle
        cx="12"
        cy="12"
        r="9"
        fill="var(--color-paper)"
        stroke="currentColor"
        strokeWidth="1.75"
      />
      <path d="M12 3a9 9 0 0 0 0 18z" fill="currentColor" />
      <path d="M12 8a4 4 0 0 0 0 8z" fill="var(--color-paper)" />
      <path d="M12 8a4 4 0 0 1 0 8z" fill="currentColor" />
    </svg>
  );
}
