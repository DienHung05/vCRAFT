'use client';

import { type ReactNode, useEffect, useLayoutEffect, useRef } from 'react';

// Layout effects only run in the browser; on the server this is a no-op, as `useEffect` would be.
const useBeforePaint = typeof window === 'undefined' ? useEffect : useLayoutEffect;

/**
 * The list of journey dots on the product page, played when it scrolls into view (GH#300). Without script, under
 * reduced motion or without IntersectionObserver the dots stay in their final state: the card is only "armed"
 * (hidden, see `.journey` in globals.css) here, before paint, when it can really be played, and the attribute
 * is set on the element itself so scrolling never re-renders anything.
 */
export function JourneyReveal({ label, children }: { label: string; children: ReactNode }) {
  const list = useRef<HTMLOListElement>(null);
  useBeforePaint(() => {
    const el = list.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    el.dataset.journey = 'armed';
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        observer.disconnect();
        el.dataset.journey = 'play';
      },
      { threshold: 0.6 },
    );
    observer.observe(el);
    return () => {
      observer.disconnect();
      delete el.dataset.journey;
    };
  }, []);
  return (
    <ol ref={list} className="journey flex items-center" aria-label={label}>
      {children}
    </ol>
  );
}
