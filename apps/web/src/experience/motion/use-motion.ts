'use client';

import { useReducedMotion } from '@vcraft/ui';
import { useEffect, useState } from 'react';

/**
 * Whether the rich motion may run here (GH#95): motion not reduced, and, when asked, a fine pointer or a
 * wide enough screen. False during server render and the first client render, so markup never differs.
 */
export function useRichMotion(options: { finePointer?: boolean; minWidth?: number } = {}): boolean {
  const reduced = useReducedMotion();
  const [allowed, setAllowed] = useState(false);
  const { finePointer, minWidth } = options;
  useEffect(() => {
    const fine = finePointer ? window.matchMedia?.('(pointer: fine)') : undefined;
    const preference = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    let prefersReduced = reduced || preference?.matches === true;
    const update = () =>
      setAllowed(
        !prefersReduced &&
          (!finePointer || fine?.matches === true) &&
          (!minWidth || window.innerWidth >= minWidth),
      );
    const onPreference = (event: MediaQueryListEvent) => {
      prefersReduced = event.matches;
      update();
    };
    update();
    preference?.addEventListener('change', onPreference);
    fine?.addEventListener('change', update);
    if (minWidth) window.addEventListener('resize', update);
    return () => {
      preference?.removeEventListener('change', onPreference);
      fine?.removeEventListener('change', update);
      if (minWidth) window.removeEventListener('resize', update);
    };
  }, [reduced, finePointer, minWidth]);
  return allowed;
}

/**
 * Runs `onEnter` once, the first time the element scrolls into view. A taller-than-viewport element
 * can never reach a high intersection ratio, so the default threshold stays low and `rootMargin`
 * pulls the trigger line slightly inside the viewport (GH#301: generic blocks, not just figures).
 */
export function useInView<T extends Element>(
  ref: { current: T | null },
  onEnter: () => void,
  enabled = true,
  {
    threshold = 0,
    rootMargin = '0px 0px -10% 0px',
  }: { threshold?: number; rootMargin?: string } = {},
): void {
  useEffect(() => {
    const el = ref.current;
    if (!enabled || !el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          observer.disconnect();
          onEnter();
        }
      },
      { threshold, rootMargin },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref, onEnter, enabled, threshold, rootMargin]);
}
