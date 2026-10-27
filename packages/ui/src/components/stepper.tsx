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
  className?: string;
}

/**
 * Thanh tiến trình trạng thái dạng "các công đoạn lò" (BRAND §9, FR-RFQ-12): đường nối
 * nóng dần từ màu đất sang màu lửa ở các chặng đã qua. Cuộn ngang trên màn hẹp.
 */
export function Stepper({ steps, current, state = 'active', label, className }: StepperProps) {
  return (
    <nav aria-label={label} className={cn('overflow-x-auto', className)}>
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
    </nav>
  );
}
