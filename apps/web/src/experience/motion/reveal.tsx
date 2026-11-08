'use client';

import { type CSSProperties, type ReactNode, useEffect, useRef, useState } from 'react';
import { useRichMotion } from './use-motion';

type RevealTag = 'div' | 'li' | 'section';

/**
 * Shared scroll reveal (GH#301): a block below the fold fades up into place the first time it scrolls
 * near the viewport (`.reveal` in globals.css, opacity and transform only, so the box never moves and
 * nothing shifts). `delay` (ms) staggers siblings, e.g. cards in one grid row. Content that starts on
 * screen, content under reduced motion and content in a browser without IntersectionObserver is never
 * hidden. Server components keep their markup; only this leaf is a client component.
 */
export function Reveal({
  children,
  className,
  delay = 0,
  as: Tag = 'div',
  ...aria
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  as?: RevealTag;
  'aria-label'?: string;
  'aria-labelledby'?: string;
}) {
  const ref = useRef<HTMLElement>(null);
  const motion = useRichMotion();
  const [state, setState] = useState<'idle' | 'armed' | 'in'>('idle');

  useEffect(() => {
    const el = ref.current;
    if (!motion || !el || typeof IntersectionObserver === 'undefined') return;
    // Only blocks still below the fold are hidden, so nothing already on screen blinks.
    if (el.getBoundingClientRect().top <= window.innerHeight) return;
    setState('armed');
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          observer.disconnect();
          setState('in');
        }
      },
      { rootMargin: '0px 0px -8% 0px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [motion]);

  const classes = [className, state === 'armed' && 'reveal', state === 'in' && 'reveal reveal-in']
    .filter(Boolean)
    .join(' ');
  const style: CSSProperties | undefined =
    state === 'idle' || delay <= 0
      ? undefined
      : ({ '--reveal-delay': `${delay}ms` } as CSSProperties);

  return (
    // biome-ignore lint/suspicious/noExplicitAny: one polymorphic ref for three intrinsic tags.
    <Tag ref={ref as any} className={classes || undefined} style={style} {...aria}>
      {children}
    </Tag>
  );
}

/** Stagger delay for the n-th card of a grid: a short ripple that restarts every `perRow` cards. */
export function staggerDelay(index: number, perRow = 4, stepMs = 70): number {
  return (index % perRow) * stepMs;
}
