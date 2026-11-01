'use client';

import { useEffect, useRef } from 'react';

/**
 * Ref for an `aria-hidden` container whose content is built by a third-party library (a map): takes
 * every focusable node inside it out of the tab order, now and as the library adds more (WCAG 4.1.2,
 * axe `aria-hidden-focus`). Pass a value that changes when the container (re)mounts.
 */
export function useUntabbable<T extends HTMLElement>(mountKey?: unknown) {
  const ref = useRef<T>(null);
  // biome-ignore lint/correctness/useExhaustiveDependencies: `mountKey` only re-runs the effect when the container mounts.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const strip = () => {
      for (const node of el.querySelectorAll(
        'a[href], button, canvas, summary, input, select, textarea, [tabindex]',
      )) {
        if (node.getAttribute('tabindex') !== '-1') node.setAttribute('tabindex', '-1');
      }
    };
    strip();
    const observer = new MutationObserver(strip);
    observer.observe(el, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [mountKey]);
  return ref;
}
