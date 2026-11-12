'use client';

import { useEffect, useRef } from 'react';
import { cn } from '../lib/cn';

export interface StepperStep {
  id: string;
  label: string;
  /** Dòng phụ dưới nhãn (vd. ngày đạt mốc). */
  hint?: string;
}

export interface StepperProps {
  steps: readonly StepperStep[];
  /** Chỉ số bước hiện tại. Các bước trước đã xong. */
  current: number;
  /** `halted`: luồng dừng ở bước hiện tại (hủy, hết hạn); bước hiện tại tô màu son. */
  state?: 'active' | 'halted';
  /** Nhãn truy cập được của cả thanh tiến trình. */
  label: string;
  /**
   * Dòng gọn thay cho thanh đầy đủ ở màn dưới 640 px (vd. "Bước 5/6 · Đang sản xuất"). Khi có, thanh đầy
   * đủ chỉ hiện từ `sm:` trở lên; khi không có, thanh đầy đủ luôn hiện và tự cuộn bước hiện tại vào giữa.
   */
  compactLabel?: string;
  className?: string;
}

/**
 * Thanh tiến trình trạng thái dạng "các công đoạn lò" (BRAND §9, FR-RFQ-12): đường nối
 * nóng dần từ màu đất sang màu lửa ở các chặng đã qua. Cuộn ngang trên màn hẹp.
 */
export function Stepper({
  steps,
  current,
  state = 'active',
  label,
  compactLabel,
  className,
}: StepperProps) {
  const scroller = useRef<HTMLDivElement>(null);
  // Bring the current step to the middle of the strip on mount and when it changes. Only the strip's own
  // scroll position moves (never the page), so it needs no `scrollIntoView`.
  // biome-ignore lint/correctness/useExhaustiveDependencies: `current` is the trigger; the effect reads the DOM, not the prop.
  useEffect(() => {
    const strip = scroller.current;
    const item = strip?.querySelector<HTMLElement>('[aria-current="step"]');
    if (!strip || !item || strip.scrollWidth <= strip.clientWidth) return;
    const stripBox = strip.getBoundingClientRect();
    const itemBox = item.getBoundingClientRect();
    const offset = itemBox.left - stripBox.left - (strip.clientWidth - itemBox.width) / 2;
    strip.scrollLeft = Math.max(0, strip.scrollLeft + offset);
  }, [current]);
  const total = steps.length;
  return (
    <nav aria-label={label} className={className}>
      {compactLabel ? (
        <div className="sm:hidden">
          <p aria-current="step" className="text-small font-semibold text-ink">
            {compactLabel}
          </p>
          <div aria-hidden="true" className="mt-2 flex gap-1">
            {steps.map((step, i) => (
              <span
                key={step.id}
                className={cn(
                  'h-1 flex-1 rounded-full',
                  i < current && 'bg-clay',
                  i === current && (state === 'halted' ? 'bg-seal' : 'bg-clay'),
                  i > current && 'bg-ink/12',
                )}
              />
            ))}
          </div>
        </div>
      ) : null}
      <div
        ref={scroller}
        // biome-ignore lint/a11y/noNoninteractiveTabindex: a horizontally scrollable region must be focusable so keyboard users can scroll it (WCAG 2.1.1).
        tabIndex={0}
        data-steps={total}
        className={cn(
          'overflow-x-auto py-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-glaze',
          compactLabel && 'hidden sm:block',
        )}
      >
        <ol className="flex min-w-max items-start">
          {steps.map((step, i) => {
            const done = i < current;
            const isCurrent = i === current;
            return (
              <li
                key={step.id}
                className="flex w-36 flex-col items-center gap-2 text-center sm:w-40"
                {...(isCurrent ? { 'aria-current': 'step' as const } : {})}
              >
                <div className="relative flex w-full items-center justify-center">
                  {i > 0 ? (
                    <span
                      aria-hidden="true"
                      className={cn(
                        'absolute top-1/2 right-1/2 h-0.5 w-full -translate-y-1/2',
                        done || isCurrent
                          ? 'bg-linear-to-r from-clay to-[color-mix(in_oklch,var(--color-clay)_60%,var(--color-seal))]'
                          : 'bg-ink/12',
                      )}
                    />
                  ) : null}
                  <span
                    className={cn(
                      'relative z-10 grid size-8 place-items-center rounded-full font-mono text-small',
                      done && 'bg-clay text-paper',
                      isCurrent &&
                        (state === 'halted'
                          ? 'bg-seal text-paper'
                          : 'bg-paper text-clay ring-2 ring-clay ring-offset-2 ring-offset-paper'),
                      !done && !isCurrent && 'bg-paper text-ash ring-1 ring-ink/15',
                    )}
                  >
                    {done ? '✓' : i + 1}
                  </span>
                </div>
                <span
                  className={cn(
                    'text-small leading-snug',
                    isCurrent ? 'font-semibold text-ink' : done ? 'text-ink' : 'text-ash',
                  )}
                >
                  {step.label}
                </span>
                {step.hint ? (
                  <span className="font-mono text-[0.75rem] text-ash">{step.hint}</span>
                ) : null}
              </li>
            );
          })}
        </ol>
      </div>
    </nav>
  );
}
