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
    let x = 0;
    let y = 0;
    let tx = 0;
    let ty = 0;
    let big = false;
    let visible = false;
    let frame = 0;
    const tick = () => {
      frame = 0;
      x += (tx - x) * 0.35;
      y += (ty - y) * 0.35;
      const settled = Math.abs(tx - x) < 0.1 && Math.abs(ty - y) < 0.1;
      if (settled) {
        x = tx;
        y = ty;
      }
      el.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%) scale(${big ? 2.4 : 1})`;
      if (!settled) frame = requestAnimationFrame(tick);
    };
    const move = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse') return;
      tx = event.clientX;
      ty = event.clientY;
      big = Boolean((event.target as Element | null)?.closest?.('a, button, [role="button"]'));
      if (!visible) {
        // Start under the pointer, including after returning from another window.
        x = tx;
        y = ty;
        visible = true;
        el.style.opacity = '1';
      }
      if (!frame) frame = requestAnimationFrame(tick);
    };
    const leave = () => {
      visible = false;
      el.style.opacity = '0';
      cancelAnimationFrame(frame);
      frame = 0;
    };
    window.addEventListener('pointermove', move, { passive: true });
    window.addEventListener('blur', leave);
    document.documentElement.addEventListener('pointerleave', leave);
    return () => {
      leave();
      window.removeEventListener('pointermove', move);
      window.removeEventListener('blur', leave);
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
