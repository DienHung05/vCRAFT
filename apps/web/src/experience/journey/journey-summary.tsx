'use client';

import type { JournalStage } from '@vcraft/domain';
import { type CSSProperties, useCallback, useEffect, useRef, useState } from 'react';
import { readDeviceFacts } from '@/experience/hero-vase/capability';
import { useInView, useRichMotion } from '@/experience/motion/use-motion';
import { StageIcon } from './stage-icon';
import './journey.css';

/** A stage link stays usable before hydration and on phones, even when it has no journal record. */
export function JourneySummary({
  label,
  steps,
}: {
  label: string;
  steps: readonly {
    stage: JournalStage;
    name: string;
    href: string;
    recorded: boolean;
  }[];
}) {
  const ref = useRef<HTMLOListElement>(null);
  const motion = useRichMotion({ minWidth: 1024 });
  const [webgl, setWebgl] = useState(false);
  useEffect(() => {
    if (motion) setWebgl(readDeviceFacts().webgl);
  }, [motion]);
  const [entered, setEntered] = useState(false);
  const [dismissed, setDismissed] = useState<JournalStage | null>(null);
  const enter = useCallback(() => setEntered(true), []);
  useInView(ref, enter, motion && webgl && !entered);

  return (
    <ol
      ref={ref}
      aria-label={label}
      className="journey-summary"
      data-play={(motion && webgl && entered) || undefined}
    >
      {steps.map((step, index) => (
        <li key={step.stage} style={{ '--journey-delay': `${index * 40}ms` } as CSSProperties}>
          <a
            href={step.href}
            aria-label={step.name}
            data-missing={!step.recorded || undefined}
            data-tooltip-dismissed={dismissed === step.stage || undefined}
            onKeyDown={(event) => {
              if (event.key === 'Escape') setDismissed(step.stage);
            }}
            onBlur={() => setDismissed(null)}
            onMouseLeave={() => setDismissed(null)}
          >
            {step.recorded ? <span aria-hidden="true" className="journey-summary-fill" /> : null}
            <StageIcon stage={step.stage} className="relative size-5" />
            <span aria-hidden="true" className="journey-summary-label">
              {step.name}
            </span>
          </a>
        </li>
      ))}
    </ol>
  );
}
