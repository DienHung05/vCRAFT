'use client';

import { JOURNAL_STAGES, type JournalStage } from '@vcraft/domain';
import { useTranslations } from 'next-intl';
import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { stageState } from '@/experience/motion/motion-math';
import { useRichMotion } from '@/experience/motion/use-motion';
import { recordedAt } from './fire-story-math';
import { useJourneyStory } from './journey-story-context';
import './trace-story.css';

/**
 * The journey of one piece as a scroll story (GH#300), the trace page counterpart of the home page's `DayStory`.
 * On wide screens with motion allowed the illustration beside the steps is sticky: each recorded step of the
 * journal comes into focus in turn, the connector heats from clay to fire colour, and the piece takes shape
 * stage by stage. The scroll logic is a separate chunk, imported only then.
 *
 * Everywhere else (reduced motion, under 1024 px, before hydration) nothing is sticky or animated: the final
 * illustration sits above the readable list of steps. `children` is that list, an `<ol>` of `data-fire-step`
 * items with a `data-fire-steps` mark and a `data-fire-heat` line; it stays in the DOM in both modes. The step
 * in focus carries `aria-current="step"`, and the stage chips beside the illustration jump to a step with the
 * keyboard; a stage the journal has no entry for is left out of the track.
 */
export function FireStory({
  figure,
  stages,
  children,
}: {
  /** The server-rendered illustration, a `PieceFigure`. */
  figure: ReactNode;
  /** The stage of each step, in list order. */
  stages: readonly JournalStage[];
  children: ReactNode;
}) {
  const t = useTranslations('trace');
  const names = useTranslations('stages');
  const root = useRef<HTMLDivElement>(null);
  const motion = useRichMotion({ minWidth: 1024 });
  const shared = useJourneyStory();
  const [localActive, setLocalActive] = useState(0);
  const active = shared?.active ?? localActive;
  const setActive = shared?.setActive ?? setLocalActive;
  const stepsOf = useCallback(
    () => Array.from(root.current?.querySelectorAll<HTMLElement>('[data-fire-step]') ?? []),
    [],
  );

  // Scroll tracking, loaded lazily and only when the story runs.
  useEffect(() => {
    const el = root.current;
    if (!motion || !el) return;
    let cancelled = false;
    let stop: (() => void) | undefined;
    void import('./fire-story-scroll').then(({ trackFireStory }) => {
      const list = el.querySelector<HTMLElement>('[data-fire-steps]');
      if (cancelled || !list) return;
      stop = trackFireStory({
        steps: stepsOf(),
        list,
        heat: el.querySelector<HTMLElement>('[data-fire-heat]'),
        onFocus: setActive,
      });
    });
    return () => {
      cancelled = true;
      stop?.();
    };
  }, [motion, stepsOf, setActive]);

  // Focusing anything inside a step (a link, or the step itself) brings that step into focus.
  useEffect(() => {
    const el = root.current;
    if (!motion || !el) return;
    const onFocusIn = (event: FocusEvent) => {
      const step = (event.target as HTMLElement).closest<HTMLElement>('[data-fire-step]');
      const index = step ? stepsOf().indexOf(step) : -1;
      if (index >= 0) setActive(index);
    };
    el.addEventListener('focusin', onFocusIn);
    return () => el.removeEventListener('focusin', onFocusIn);
  }, [motion, stepsOf, setActive]);

  // Mark the steps on the list itself: state for the styles, `aria-current` for assistive tech.
  useEffect(() => {
    stepsOf().forEach((step, index) => {
      if (motion) {
        step.dataset.fireState = stageState(index, active);
        step.tabIndex = -1;
        if (index === active) step.setAttribute('aria-current', 'step');
        else step.removeAttribute('aria-current');
      } else {
        delete step.dataset.fireState;
        step.removeAttribute('tabindex');
        step.removeAttribute('aria-current');
      }
    });
  }, [motion, active, stepsOf]);

  const goTo = useCallback(
    (index: number) => {
      const step = stepsOf()[index];
      if (!step) return;
      setActive(index);
      step.focus({ preventScroll: true });
      step.scrollIntoView({ behavior: 'smooth', block: 'center' });
    },
    [stepsOf, setActive],
  );

  // The story card beside the steps jumps to a step through the same function as the chips.
  const register = shared?.registerGoTo;
  useEffect(() => {
    if (!motion || !register) return;
    register(goTo);
    return () => register(null);
  }, [motion, register, goTo]);

  const stage = motion ? (stages[active] ?? 'finish') : 'finish';
  const at = recordedAt(stages);
  return (
    <div ref={root} data-fire-story={motion ? 'on' : undefined} className="fire-story">
      <div className="fire-figure" data-piece-stage={stage}>
        {figure}
        <p className="fire-note">{t('pieceNote')}</p>
        {motion ? (
          <nav aria-label={t('storyTrack')}>
            <ol className="fire-track">
              {JOURNAL_STAGES.filter((s) => at[s] >= 0).map((s) => (
                <li key={s}>
                  <button
                    type="button"
                    className="fire-chip"
                    data-current={s === stage ? 'true' : undefined}
                    onClick={() => goTo(at[s])}
                  >
                    {names(`${s}.name`)}
                  </button>
                </li>
              ))}
            </ol>
          </nav>
        ) : null}
      </div>
      <div className="fire-steps">{children}</div>
    </div>
  );
}
