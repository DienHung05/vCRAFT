'use client';

import { type ReactNode, useEffect, useRef } from 'react';
import { storyDistance } from './motion-math';
import { useRichMotion } from './use-motion';

/**
 * "A day in Bát Tràng" as a horizontal scroll story (GH#95, Lenis + ScrollTrigger). On wide screens with
 * motion allowed, the section pins and vertical scrolling slides the six stages sideways, with Lenis
 * smoothing the wheel. Everywhere else the strip stays the native, keyboard-scrollable row it is in the
 * server markup. `children` is that strip; the wrapper keeps its role, label and focusability.
 */
export function DayStory({
  children,
  labelledBy,
  className,
}: {
  children: ReactNode;
  labelledBy: string;
  className?: string;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const motion = useRichMotion({ minWidth: 1024 });

  useEffect(() => {
    const el = scroller.current;
    const section = el?.closest('section');
    const strip = el?.firstElementChild as HTMLElement | null;
    if (!motion || !el || !section || !strip) return;
    let cleanup: (() => void) | undefined;
    let cancelled = false;
    void (async () => {
      const [{ gsap }, { ScrollTrigger }, { default: Lenis }] = await Promise.all([
        import('gsap'),
        import('gsap/ScrollTrigger'),
        import('lenis'),
      ]);
      if (cancelled) return;
      gsap.registerPlugin(ScrollTrigger);
      const lenis = new Lenis({ lerp: 0.12 });
      const raf = (time: number) => lenis.raf(time * 1000);
      lenis.on('scroll', ScrollTrigger.update);
      gsap.ticker.add(raf);
      gsap.ticker.lagSmoothing(0);
      // While pinned the strip moves by transform, so the native scroller and its snapping step aside.
      el.style.overflowX = 'hidden';
      const distance = () => storyDistance(strip.scrollWidth, el.clientWidth);
      const tween = gsap.to(strip, {
        x: () => -distance(),
        ease: 'none',
        scrollTrigger: {
          trigger: section,
          start: 'top top',
          end: () => `+=${distance()}`,
          pin: true,
          scrub: 0.6,
          invalidateOnRefresh: true,
        },
      });
      cleanup = () => {
        tween.scrollTrigger?.kill();
        tween.kill();
        gsap.set(strip, { clearProps: 'transform' });
        gsap.ticker.remove(raf);
        lenis.destroy();
        el.style.overflowX = '';
      };
    })();
    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [motion]);

  return (
    // biome-ignore lint/a11y/useSemanticElements: a named group around a scroller, not a form fieldset; a second `section` would repeat the landmark name.
    <div
      ref={scroller}
      role="group"
      aria-labelledby={labelledBy}
      // biome-ignore lint/a11y/noNoninteractiveTabindex: the native scroller must take focus to scroll with the arrow keys (WCAG 2.1.1).
      tabIndex={0}
      className={className}
    >
      {children}
    </div>
  );
}
