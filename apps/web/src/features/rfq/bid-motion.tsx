'use client';

import { reducedFadeMs, spring, useReducedMotion } from '@vcraft/ui';
import { motion } from 'motion/react';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { countUpValue } from '@/experience/motion/motion-math';

const COUNT_MS = 900;

/**
 * One offer in the buyer's comparison (BRAND §6.3 #8, "a bid lands on the table"): a new offer slides
 * in from above and the others make room with a spring layout move. Transform and opacity only. Under
 * reduced motion it fades in over 150 ms and does not move. Use inside `<AnimatePresence initial={false}>`
 * so offers already there on first load do not animate.
 */
export function BidRow({ children }: { children: ReactNode }) {
  const reduced = useReducedMotion();
  return (
    <motion.li
      layout={reduced ? false : 'position'}
      initial={reduced ? { opacity: 0 } : { opacity: 0, y: -24, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0 }}
      transition={reduced ? { duration: reducedFadeMs / 1000 } : spring.clay}
    >
      {children}
    </motion.li>
  );
}

/**
 * An amount that counts up from zero when it first appears (BRAND §6.3 #8). It renders the final text
 * on the server and for reduced motion, and keeps tabular digits so the row does not reflow.
 */
export function CountUpMoney({ vnd, format }: { vnd: number; format: (vnd: number) => string }) {
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(vnd);
  const counted = useRef(false);
  useEffect(() => {
    if (reduced || counted.current || !(vnd > 0)) {
      setShown(vnd);
      return;
    }
    const started = performance.now();
    let frame = requestAnimationFrame(function tick(now) {
      const value = countUpValue(vnd, now - started, COUNT_MS);
      setShown(value);
      if (now - started < COUNT_MS) frame = requestAnimationFrame(tick);
      else counted.current = true;
    });
    return () => {
      cancelAnimationFrame(frame);
      setShown(vnd);
    };
  }, [vnd, reduced]);
  return (
    <span className="tabular-nums">
      <span aria-hidden="true">{format(shown)}</span>
      <span className="sr-only">{format(vnd)}</span>
    </span>
  );
}
