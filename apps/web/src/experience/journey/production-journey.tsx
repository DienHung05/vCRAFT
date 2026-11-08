'use client';

import type { JournalStage } from '@vcraft/domain';
import { ProductFigure, type ProductFigureKind } from '@vcraft/ui';
import { type FocusEvent, type ReactNode, useEffect, useRef, useState } from 'react';
import { readDeviceFacts } from '@/experience/hero-vase/capability';
import { StageIcon } from './stage-icon';
import './journey.css';

interface JourneyStep {
  id: string;
  stage: JournalStage;
  name: string;
  number: number;
}

/** Enhances the server-rendered journal. Its entries and correction links never leave the DOM. */
export function ProductionJourney({
  children,
  steps,
  kind,
  label,
  illustrationLabel,
}: {
  children: ReactNode;
  steps: readonly JourneyStep[];
  kind: ProductFigureKind;
  label: string;
  illustrationLabel: string;
}) {
  const root = useRef<HTMLDivElement>(null);
  const focusSelected = useRef(false);
  const [active, setActive] = useState(0);
  const [enhanced, setEnhanced] = useState(false);
  const [viewportHeight, setViewportHeight] = useState(0);
  const current = steps[active] ?? steps[0];

  useEffect(() => {
    const media = window.matchMedia(
      '(min-width: 1024px) and (prefers-reduced-motion: no-preference)',
    );
    let webgl: boolean | undefined;
    const update = () => {
      if (media.matches && webgl === undefined) webgl = readDeviceFacts().webgl;
      setEnhanced(media.matches && webgl === true && 'IntersectionObserver' in window);
      setViewportHeight(window.innerHeight);
    };
    update();
    media.addEventListener('change', update);
    window.addEventListener('resize', update);
    return () => {
      media.removeEventListener('change', update);
      window.removeEventListener('resize', update);
    };
  }, []);

  useEffect(() => {
    const el = root.current;
    if (!el || !enhanced) return;
    const entries = [...el.querySelectorAll<HTMLElement>('[data-journey-entry]')];
    const visible = new Set<HTMLElement>();
    const selectVisible = () => {
      const next = visible.values().next().value;
      if (next) setActive(entries.indexOf(next));
    };
    const readingLine = Math.min(240, Math.round(viewportHeight * 0.3));
    const observer = new IntersectionObserver(
      (observations) => {
        for (const observation of observations) {
          const entry = observation.target as HTMLElement;
          if (observation.isIntersecting) visible.add(entry);
          else visible.delete(entry);
        }
        // Observe only the reading band. No per-frame work or smooth-scroll runtime is needed.
        if (!focusSelected.current) selectVisible();
      },
      {
        // Pixel margins keep the reading line at the same viewport height on ultrawide screens.
        rootMargin: `-${readingLine}px 0px -${Math.max(0, viewportHeight - readingLine - 8)}px 0px`,
        threshold: 0,
      },
    );
    for (const entry of entries) observer.observe(entry);
    const resumeScrolling = () => {
      focusSelected.current = false;
      selectVisible();
    };
    const scrollKey = (event: KeyboardEvent) => {
      if (['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', 'Home', 'End', ' '].includes(event.key))
        resumeScrolling();
    };
    window.addEventListener('wheel', resumeScrolling, { passive: true });
    window.addEventListener('touchstart', resumeScrolling, { passive: true });
    window.addEventListener('pointerdown', resumeScrolling, { passive: true });
    window.addEventListener('keydown', scrollKey);
    return () => {
      observer.disconnect();
      window.removeEventListener('wheel', resumeScrolling);
      window.removeEventListener('touchstart', resumeScrolling);
      window.removeEventListener('pointerdown', resumeScrolling);
      window.removeEventListener('keydown', scrollKey);
    };
  }, [enhanced, viewportHeight]);

  useEffect(() => {
    const entries = root.current?.querySelectorAll<HTMLElement>('[data-journey-entry]');
    entries?.forEach((entry, index) => {
      if (index === active) entry.setAttribute('aria-current', 'step');
      else entry.removeAttribute('aria-current');
      entry.dataset.journeyState = index <= active ? 'reached' : 'ahead';
    });
  }, [active]);

  const focusEntry = (event: FocusEvent<HTMLDivElement>) => {
    const entry = event.target.closest<HTMLElement>('[data-journey-entry]');
    focusSelected.current = !!entry;
    if (!entry) return;
    const index = steps.findIndex((step) => step.id === entry.id);
    if (index >= 0) setActive(index);
  };

  return (
    <div
      ref={root}
      className="production-journey"
      data-enhanced={enhanced || undefined}
      onFocusCapture={focusEntry}
    >
      {current ? (
        <aside className="journey-companion" aria-label={label}>
          <figure className="journey-figure">
            <div className="journey-art" data-stage={current.stage} aria-hidden="true">
              <svg
                className="journey-wheel"
                viewBox="0 0 320 260"
                aria-hidden="true"
                focusable="false"
              >
                <ellipse cx="160" cy="231" rx="116" ry="13" />
                <path d="M44 231v8c0 18 232 18 232 0v-8 M160 250v10" />
              </svg>
              <svg
                className="journey-piece journey-clay"
                viewBox="0 0 160 180"
                aria-hidden="true"
                focusable="false"
              >
                <path
                  d="M21 163c-6-20 10-27 11-45 2-16 22-18 29-8 8-31 36-27 40-7 20-12 38 3 33 22 17 12 18 28 8 38Z"
                  fill="currentColor"
                />
                <path
                  d="M43 142q12-18 28-6m7-14q17-8 27 5"
                  fill="none"
                  stroke="var(--color-paper)"
                  strokeWidth="2"
                />
              </svg>
              <ProductFigure
                kind={kind}
                className="journey-piece journey-body"
                body="var(--journey-body)"
                band="var(--journey-band)"
              />
              <ProductFigure
                kind={kind}
                className="journey-piece journey-finished"
                body="var(--color-glaze)"
                band="var(--color-paper)"
              />
              <svg
                className="journey-kiln"
                viewBox="0 0 320 260"
                aria-hidden="true"
                focusable="false"
              >
                <path d="M27 233V135a133 133 0 0 1 266 0v98M42 233V135a118 118 0 0 1 236 0v98" />
                <path d="m32 125 17 2m-9-48 16 6m12-43 12 12m32-37 6 16m42-24v17m48-9-6 16m38 9-12 12m28 25-16 6m24 40-17 2" />
              </svg>
              <StageIcon stage={current.stage} className="journey-tool" />
            </div>
            <figcaption>
              <p className="text-h3 text-glaze">{current.name}</p>
              <p className="mt-2 text-small text-ash">{illustrationLabel}</p>
            </figcaption>
          </figure>
          <ol className="journey-navigation" aria-label={label}>
            {steps.map((step, index) => (
              <li key={step.id}>
                <a
                  href={`#${step.id}`}
                  aria-current={index === active ? 'step' : undefined}
                  aria-label={`${step.number}. ${step.name}`}
                >
                  <StageIcon stage={step.stage} className="size-5" />
                  <span className="journey-navigation-label">{step.name}</span>
                </a>
              </li>
            ))}
          </ol>
        </aside>
      ) : null}
      <div className="journey-records">{children}</div>
    </div>
  );
}
