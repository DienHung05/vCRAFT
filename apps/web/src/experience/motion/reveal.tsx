'use client';

import { type ReactNode, useCallback, useRef, useState } from 'react';
import { useInView, useRichMotion } from './use-motion';

/**
 * Reveals a block the first time it scrolls into view (GH#301): the block rests visible, and only a
 * block that starts below the fold on a motion-capable visitor gets the `reveal-armed` → `reveal-in`
 * classes (globals.css). Opacity and transform only, so nothing shifts (CLS 0); reduced motion and
 * no-JS never arm, so the content is simply there.
 */
export function Reveal({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  /** Extra stagger before the rise, in ms; small values only (0–160). */
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const motion = useRichMotion();
  const [state, setState] = useState<'idle' | 'armed' | 'in'>('idle');
  const enter = useCallback(() => setState('in'), []);
  // Arm only blocks still below the fold, so nothing already on screen blinks.
  const arm = useCallback((el: HTMLDivElement | null) => {
    ref.current = el;
    if (el && el.getBoundingClientRect().top > window.innerHeight) setState('armed');
  }, []);
  useInView(ref, enter, motion && state === 'armed');

  // Reduced motion switched on after arming (or the element left armed for any reason): show it.
  const settled = state === 'in' || !motion;
  const classes = [
    className,
    state === 'armed' && !settled ? 'reveal-armed' : '',
    settled ? 'reveal-in' : '',
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <div
      ref={motion ? arm : ref}
      className={classes}
      {...(delay ? { style: { transitionDelay: `${delay}ms` } } : {})}
    >
      {children}
    </div>
  );
}
