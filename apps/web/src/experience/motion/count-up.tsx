'use client';

import { useCallback, useRef } from 'react';
import { countUpValue, parseFigure } from './motion-math';
import { useInView, useRichMotion } from './use-motion';

const DURATION_MS = 1_400;

/**
 * A figure that counts up from zero the first time it scrolls into view (GH#95). The server renders the
 * final text, so crawlers, screen readers and reduced motion see the real number, and nothing shifts:
 * digits are tabular and the box keeps the final width while it counts.
 */
export function CountUp({ text, locale }: { text: string; locale: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const motion = useRichMotion();
  const figure = parseFigure(text);
  const run = useCallback(() => {
    const el = ref.current;
    if (!el || !figure) return;
    const format = new Intl.NumberFormat(locale);
    el.style.minWidth = `${el.getBoundingClientRect().width}px`;
    const started = performance.now();
    const tick = (now: number) => {
      const value = countUpValue(figure.value, now - started, DURATION_MS);
      el.textContent = `${figure.prefix}${format.format(value)}${figure.suffix}`;
      if (now - started < DURATION_MS) requestAnimationFrame(tick);
      else el.textContent = text;
    };
    requestAnimationFrame(tick);
  }, [figure, locale, text]);
  useInView(ref, run, motion && figure !== null);

  return (
    <span ref={ref} className="inline-block tabular-nums">
      {text}
    </span>
  );
}
