'use client';

import { useEffect, useRef } from 'react';
import { useRichMotion } from './use-motion';

/**
 * An ink drop that trails the mouse and swells over links and buttons (GH#95). Mouse only, off under
 * reduced motion and on touch screens; the real cursor stays, so nothing is hidden from anyone.
 */
export function InkCursor() {
  const dot = useRef<HTMLDivElement>(null);
  const motion = useRichMotion({ finePointer: true });

  useEffect(() => {
    const el = dot.current;
    if (!motion || !el) return;
    let x = -100;
    let y = -100;
    let tx = x;
    let ty = y;
    let big = false;
    let frame = 0;
    const move = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse') return;
      tx = event.clientX;
      ty = event.clientY;
      big = Boolean((event.target as Element | null)?.closest?.('a, button, [role="button"]'));
      el.style.opacity = '1';
    };
    const leave = () => {
      el.style.opacity = '0';
    };
    const tick = () => {
      x += (tx - x) * 0.22;
      y += (ty - y) * 0.22;
      el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%) scale(${big ? 2.4 : 1})`;
      frame = requestAnimationFrame(tick);
    };
    window.addEventListener('pointermove', move, { passive: true });
    document.documentElement.addEventListener('pointerleave', leave);
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('pointermove', move);
      document.documentElement.removeEventListener('pointerleave', leave);
    };
  }, [motion]);

  if (!motion) return null;
  return (
    <div
      ref={dot}
      aria-hidden
      className="pointer-events-none fixed top-0 left-0 z-50 size-3 rounded-full bg-glaze/60 opacity-0 transition-opacity duration-(--duration-quick)"
    />
  );
}
