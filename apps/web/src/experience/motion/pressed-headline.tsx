'use client';

import { type ReactNode, useEffect, useRef } from 'react';
import { useRichMotion } from './use-motion';

/**
 * The hero headline pressed into clay letter by letter (GH#95, SplitText): each character settles from a
 * squashed, lifted shape into place. Only transforms move, never opacity, so the text is readable and
 * counts as painted from the first frame (LCP), and words keep their line breaks (no layout shift).
 * Off under reduced motion; GSAP loads only when it runs.
 */
export function PressedHeadline({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLHeadingElement>(null);
  const motion = useRichMotion();

  useEffect(() => {
    const el = ref.current;
    if (!motion || !el) return;
    let revert: (() => void) | undefined;
    let cancelled = false;
    void (async () => {
      const [{ gsap }, { SplitText }] = await Promise.all([
        import('gsap'),
        import('gsap/SplitText'),
      ]);
      if (cancelled) return;
      gsap.registerPlugin(SplitText);
      const split = SplitText.create(el, { type: 'words,chars', aria: 'auto' });
      const tween = gsap.from(split.chars, {
        yPercent: -18,
        scaleY: 1.35,
        scaleX: 0.85,
        transformOrigin: '50% 100%',
        duration: 0.7,
        ease: 'back.out(2.2)',
        stagger: 0.025,
        onComplete: () => split.revert(),
      });
      revert = () => {
        tween.kill();
        split.revert();
      };
    })();
    return () => {
      cancelled = true;
      revert?.();
    };
  }, [motion]);

  return (
    <h1 ref={ref} className={className}>
      {children}
    </h1>
  );
}
