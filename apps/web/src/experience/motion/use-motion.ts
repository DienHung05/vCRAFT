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
    if (reduced) return setAllowed(false);
    const fine = !finePointer || window.matchMedia('(pointer: fine)').matches;
    const wide = !minWidth || window.innerWidth >= minWidth;
    setAllowed(fine && wide);
  }, [reduced, finePointer, minWidth]);
  return allowed;
}

/** Runs `onEnter` once, the first time the element scrolls into view. */
export function useInView<T extends Element>(
  ref: { current: T | null },
  onEnter: () => void,
  enabled = true,
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
      { threshold: 0.35 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref, onEnter, enabled]);
}
