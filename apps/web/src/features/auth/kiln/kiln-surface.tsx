'use client';

import { type HTMLAttributes, useEffect, useMemo, useRef } from 'react';
import { createKilnFeedback, KilnFeedbackContext } from './kiln-feedback';

/** The sheen layer is moved only while a mouse-like pointer hovers the card (never on touch). */
const HOVER_QUERY = '(hover: hover) and (pointer: fine)';
const REDUCED_QUERY = '(prefers-reduced-motion: reduce)';

/**
 * The glazed card's surface. Server-rendered children pass straight through, so the forms inside stay
 * server-composed. It provides `useKilnFeedback()` to the forms inside (fire, fail, seal, reset: see
 * `kiln-feedback.ts`), clears the card when the page comes back from the back/forward cache, and runs the
 * pointer sheen.
 *
 * The sheen is compositor-only: a fixed-size radial layer inside a clipped box is moved with
 * `transform: translate3d`, written straight to its style (no React state, no custom property, no
 * repaint), at most once per animation frame, and only on hover-capable fine pointers with motion allowed.
 */
export function KilnSurface({ children, ...props }: HTMLAttributes<HTMLDivElement>) {
  const surface = useRef<HTMLDivElement>(null);
  const sheen = useRef<HTMLSpanElement>(null);
  const feedback = useMemo(() => createKilnFeedback(() => surface.current), []);

  // Back/forward cache: a page restored from it must not show a stamped, dead card.
  useEffect(() => {
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) feedback.reset();
    };
    window.addEventListener('pageshow', onPageShow);
    return () => window.removeEventListener('pageshow', onPageShow);
  }, [feedback]);

  useEffect(() => {
    const host = surface.current;
    const glow = sheen.current;
    if (!host || !glow || typeof window.matchMedia !== 'function') return;

    const hover = window.matchMedia(HOVER_QUERY);
    const calm = window.matchMedia(REDUCED_QUERY);
    let frame = 0;
    let pointerX = 0;
    let pointerY = 0;
    let listening = false;

    const paint = () => {
      frame = 0;
      const box = host.getBoundingClientRect();
      // The layer rests at 15% / 9% of the card (see kiln.css); move it by the offset from there.
      const dx = pointerX - box.left - box.width * 0.15;
      const dy = pointerY - box.top - box.height * 0.09;
      glow.style.transform = `translate3d(${dx.toFixed(1)}px, ${dy.toFixed(1)}px, 0)`;
    };
    const move = (event: PointerEvent) => {
      pointerX = event.clientX;
      pointerY = event.clientY;
      if (frame === 0) frame = requestAnimationFrame(paint);
    };
    // Back to the resting highlight (upper left): dropping the transform lets the CSS transition glide it home.
    const rest = () => {
      if (frame !== 0) cancelAnimationFrame(frame);
      frame = 0;
      glow.style.removeProperty('transform');
    };
    const sync = () => {
      const wanted = hover.matches && !calm.matches;
      if (wanted === listening) return;
      listening = wanted;
      if (wanted) {
        host.addEventListener('pointermove', move, { passive: true });
        host.addEventListener('pointerleave', rest);
      } else {
        host.removeEventListener('pointermove', move);
        host.removeEventListener('pointerleave', rest);
        rest();
      }
    };

    sync();
    hover.addEventListener('change', sync);
    calm.addEventListener('change', sync);
    return () => {
      hover.removeEventListener('change', sync);
      calm.removeEventListener('change', sync);
      host.removeEventListener('pointermove', move);
      host.removeEventListener('pointerleave', rest);
      if (frame !== 0) cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <KilnFeedbackContext value={feedback}>
      <div ref={surface} {...props}>
        <span aria-hidden="true" className="kiln-sheen">
          <span ref={sheen} className="kiln-sheen-glow" />
        </span>
        {children}
      </div>
    </KilnFeedbackContext>
  );
}
