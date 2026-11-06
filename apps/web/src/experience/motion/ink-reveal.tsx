'use client';

import { type ReactNode, useCallback, useRef, useState } from 'react';
import { useInView, useRichMotion } from './use-motion';

/**
 * Lets an image bleed in like ink on paper the first time it scrolls into view (GH#95, "ink-bleed image
 * masks"): a soft-edged mask grows from one corner (`.ink-reveal` in globals.css). Before the effect is
 * allowed, and under reduced motion, the image simply shows; the mask never changes the box size.
 */
export function InkReveal({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const motion = useRichMotion();
  const [state, setState] = useState<'idle' | 'armed' | 'in'>('idle');
  const enter = useCallback(() => setState('in'), []);
  // Arm (hide) only images still below the fold, so nothing already on screen blinks.
  const arm = useCallback((el: HTMLDivElement | null) => {
    ref.current = el;
    if (el && el.getBoundingClientRect().top > window.innerHeight) setState('armed');
  }, []);
  useInView(ref, enter, motion && state === 'armed');

  return (
    <div
      ref={motion ? arm : ref}
      className={`${className ?? ''} ${state === 'armed' ? 'ink-reveal' : ''} ${state === 'in' ? 'ink-reveal ink-reveal-in' : ''}`}
    >
      {children}
    </div>
  );
}
