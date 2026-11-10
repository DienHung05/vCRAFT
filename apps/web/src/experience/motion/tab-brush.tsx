'use client';

import { cn, durMs, easeCss } from '@vcraft/ui';
import { useReducedMotion } from 'motion/react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import './tab-brush.css';

/** Width of the stroke in its own box; `scaleX` stretches it to the active tab. */
const BASE = 100;

/**
 * Brush underline that runs to the active tab (BRAND §6.3 micro-interactions, "tab underline"). Place it
 * next to the tab list, inside the positioned element the tabs measure their offsets from: it finds the
 * `[aria-current="page"]` item there and slides with transform only, within 280 ms so it suits Studio and Admin (§6.4). It appears in place on
 * first paint; under reduced motion it jumps into place and keeps a fully drawn stroke. Decorative.
 */
export function TabBrush({
  activeKey,
  className,
}: {
  /** Changes when the active tab changes (e.g. the pathname), so the brush measures again. */
  activeKey: string;
  className?: string;
}) {
  const [box, setBox] = useState<{ x: number; width: number } | null>(null);
  const reduced = useReducedMotion();
  const placed = useRef(false);
  const self = useRef<SVGSVGElement>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: measure again whenever the active tab changes.
  useLayoutEffect(() => {
    // Its own parent is the tab list (a child's ref is set before this effect, the parent's is not yet).
    const root = self.current?.parentElement;
    if (!root) return;
    const measure = () => {
      const active = root.querySelector<HTMLElement>('[aria-current="page"]');
      setBox(
        active && active.offsetWidth > 0
          ? { x: active.offsetLeft, width: active.offsetWidth }
          : null,
      );
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(root);
    return () => observer.disconnect();
  }, [activeKey]);

  // After the first placement, later moves slide instead of jumping.
  useEffect(() => {
    if (box) placed.current = true;
  }, [box]);

  return (
    <svg
      ref={self}
      aria-hidden="true"
      focusable="false"
      data-testid="tab-brush"
      viewBox={`0 0 ${BASE} 8`}
      preserveAspectRatio="none"
      className={cn(
        'pointer-events-none absolute bottom-0 left-0 h-1.5 origin-left overflow-visible text-clay',
        className,
      )}
      style={{
        width: BASE,
        opacity: box ? 1 : 0,
        transform: box ? `translateX(${box.x}px) scaleX(${box.width / BASE})` : undefined,
        transition:
          placed.current && !reduced ? `transform ${durMs.base}ms ${easeCss.clay}` : 'none',
      }}
    >
      <path
        key={activeKey}
        className="tab-brush-stroke"
        pathLength={1}
        strokeDasharray={1}
        strokeDashoffset={0}
        d="M3 5 C 22 2.5, 45 6.5, 66 4 S 92 3.5, 97 5"
        fill="none"
        stroke="currentColor"
        strokeWidth={3}
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
