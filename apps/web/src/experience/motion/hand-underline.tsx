'use client';

import { type ReactNode, useCallback, useRef, useState } from 'react';
import { useInView } from './use-motion';

/**
 * A brush-drawn underline under a few words (GH#95, "hand-drawn underline"), drawn the first time they
 * scroll into view with the shared `.brush-draw` stroke animation. Under reduced motion that CSS shows the
 * stroke already drawn. The stroke sits in the text's own box, so nothing moves.
 */
export function HandUnderline({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [drawn, setDrawn] = useState(false);
  const draw = useCallback(() => setDrawn(true), []);
  useInView(ref, draw);

  return (
    <span ref={ref} className="relative inline-block">
      {children}
      <svg
        aria-hidden
        viewBox="0 0 200 12"
        preserveAspectRatio="none"
        className="pointer-events-none absolute -bottom-1 left-0 h-[0.35em] w-full overflow-visible text-clay"
      >
        {drawn ? (
          <path
            className="brush-draw"
            pathLength={1}
            d="M2 8 C 40 3, 80 11, 120 6 S 180 4, 198 7"
            fill="none"
            stroke="currentColor"
            strokeWidth={3}
            strokeLinecap="round"
          />
        ) : null}
      </svg>
    </span>
  );
}
