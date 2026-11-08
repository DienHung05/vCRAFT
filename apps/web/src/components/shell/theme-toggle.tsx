'use client';

import { useTranslations } from 'next-intl';
import { useSyncExternalStore } from 'react';
import {
  effectiveTheme,
  oppositeTheme,
  parseTheme,
  storeTheme,
  type Theme,
  type ThemeWave,
  themeWaveOrigin,
} from '@/lib/theme';

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

/** The running theme switch, so a second click finishes it before starting the next one. */
let running: ViewTransition | null = null;

function applyTheme(next: Theme, wave: ThemeWave | null) {
  const root = document.documentElement;
  const swap = () => {
    root.dataset.theme = next;
  };
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  storeTheme(next);
  // Plain swap under reduced motion and where the View Transitions API is missing.
  if (reduced || typeof document.startViewTransition !== 'function') {
    swap();
    return;
  }
  // A click during a running switch jumps it to its end state first, so switches never stack.
  running?.skipTransition();
  // The wave (globals.css) applies only while this attribute is set; other root transitions keep the fade.
  if (wave) {
    root.style.setProperty('--theme-wave-x', `${wave.x}px`);
    root.style.setProperty('--theme-wave-y', `${wave.y}px`);
    root.style.setProperty('--theme-wave-r', `${wave.r}px`);
    root.dataset.themeTransition = 'wave';
  }
  const transition = document.startViewTransition(swap);
  running = transition;
  transition.finished.finally(() => {
    if (running !== transition) return;
    running = null;
    delete root.dataset.themeTransition;
  });
}

/**
 * Light ⇄ dark switch in the site header. The first click flips away from the theme on screen, and the new
 * theme spreads over the page as a wave from the button (GH#214).
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
      onClick={(event) =>
        applyTheme(
          oppositeTheme(currentTheme()),
          themeWaveOrigin(event, event.currentTarget.getBoundingClientRect(), {
            width: window.innerWidth,
            height: window.innerHeight,
          }),
        )
      }
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
