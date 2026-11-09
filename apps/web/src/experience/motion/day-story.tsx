'use client';

import { useTranslations } from 'next-intl';
import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { stageAt, stageProgress, stageState } from './motion-math';
import { useRichMotion } from './use-motion';

/** Scroll distance per stage while the section is pinned, as a share of the viewport height. */
const STEP_VH = 0.35;

type JumpTo = (index: number) => void;

/**
 * "A day in Bát Tràng", one stage at a time (GH#210, after the horizontal strip of GH#95). On wide screens
 * with motion allowed the section pins; scrolling moves from stage 01 to 06, one stage in focus at a time,
 * snapping to whole stages, and then the page carries on. The photo is revealed with a clip-path and a
 * slight scale while the text lines stagger in (transform, opacity and clip-path only, see globals.css). A
 * rail of the six stage names shows the active and past stages and jumps to a stage on click.
 *
 * Everywhere else (reduced motion, screens under 1024 px) nothing pins: the stages stay the native,
 * keyboard-scrollable strip of the server markup. `children` is that strip, an `<ol>` of the six stages
 * (`data-day-stage` on each item), which stays in the DOM in both modes; the stage in focus carries
 * `aria-current="step"`.
 */
export function DayStory({
  children,
  labelledBy,
  stageNames,
  className,
}: {
  children: ReactNode;
  labelledBy: string;
  /** Stage names in order, for the progress rail. */
  stageNames: readonly string[];
  className?: string;
}) {
  const t = useTranslations('home.day');
  const scroller = useRef<HTMLDivElement>(null);
  const motion = useRichMotion({ minWidth: 1024 });
  const [active, setActive] = useState(0);
  const jump = useRef<JumpTo | null>(null);
  const count = stageNames.length;

  useEffect(() => {
    const el = scroller.current;
    const section = el?.closest('section');
    if (!motion || !el || !section) return;
    let cleanup: (() => void) | undefined;
    let cancelled = false;
    void (async () => {
      const [{ gsap }, { ScrollTrigger }] = await Promise.all([
        import('gsap'),
        import('gsap/ScrollTrigger'),
      ]);
      if (cancelled) return;
      gsap.registerPlugin(ScrollTrigger);
      el.dataset.dayStory = 'stage';
      const distance = () => Math.round(window.innerHeight * STEP_VH * (count - 1));
      const trigger = ScrollTrigger.create({
        trigger: section,
        start: 'top top',
        end: () => `+=${distance()}`,
        pin: true,
        invalidateOnRefresh: true,
        // Never rest between two stages.
        snap: {
          snapTo: count > 1 ? 1 / (count - 1) : 1,
          duration: { min: 0.2, max: 0.6 },
          delay: 0.05,
          ease: 'power1.inOut',
        },
        onUpdate: (self) => setActive(stageAt(self.progress, count)),
      });
      jump.current = (index) =>
        window.scrollTo({
          top: trigger.start + stageProgress(index, count) * (trigger.end - trigger.start),
          behavior: 'smooth',
        });
      // The pinned layout differs from the strip, so measure again once it applies.
      ScrollTrigger.refresh();
      cleanup = () => {
        jump.current = null;
        trigger.kill();
        delete el.dataset.dayStory;
      };
    })();
    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [motion, count]);

  // Mark the stages on the list itself: state for the transitions, `aria-current` for assistive tech.
  useEffect(() => {
    const items = scroller.current?.querySelectorAll<HTMLElement>('[data-day-stage]');
    items?.forEach((item, index) => {
      if (motion) {
        item.dataset.dayState = stageState(index, active);
        if (index === active) item.setAttribute('aria-current', 'step');
        else item.removeAttribute('aria-current');
      } else {
        delete item.dataset.dayState;
        item.removeAttribute('aria-current');
      }
    });
  }, [motion, active]);

  const goTo = useCallback((index: number) => jump.current?.(index), []);

  return (
    // biome-ignore lint/a11y/useSemanticElements: a named group around a scroller, not a form fieldset; a second `section` would repeat the landmark name.
    <div
      ref={scroller}
      role="group"
      aria-labelledby={labelledBy}
      // The strip scrolls with the arrow keys once focused (WCAG 2.1.1); pinned, the rail buttons take over.
      tabIndex={motion ? -1 : 0}
      className={className}
    >
      {motion ? (
        <nav aria-label={t('railLabel')} className="day-rail">
          <p className="font-mono text-small text-ash" aria-hidden="true">
            {String(active + 1).padStart(2, '0')} / {String(count).padStart(2, '0')}
          </p>
          <p className="sr-only" aria-live="polite">
            {t('current', { index: active + 1, total: count, name: stageNames[active] ?? '' })}
          </p>
          <ol className="mt-4 flex flex-col gap-1">
            {stageNames.map((name, index) => (
              <li key={name}>
                <button
                  type="button"
                  onClick={() => goTo(index)}
                  aria-current={index === active ? 'step' : undefined}
                  data-day-state={stageState(index, active)}
                  className="day-rail-step"
                >
                  <span className="font-mono">{String(index + 1).padStart(2, '0')}</span>
                  <span>{name}</span>
                </button>
              </li>
            ))}
          </ol>
        </nav>
      ) : null}
      {children}
    </div>
  );
}
