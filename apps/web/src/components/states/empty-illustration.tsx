import { cn } from '@vcraft/ui';

export type EmptyIllustrationName = 'bowl' | 'scroll' | 'magnifier' | 'bell' | 'vase';

/**
 * Small line illustrations for empty states, drawn in the brand palette (clay body, glaze
 * accent, paper fill) so they follow the light/dark tokens. Decorative: the heading of the
 * empty state carries the meaning.
 */
export function EmptyIllustration({
  name = 'bowl',
  className,
}: {
  name?: EmptyIllustrationName;
  className?: string;
}) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 160 120"
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn('block h-28 w-auto', className)}
    >
      <ellipse cx="80" cy="108" rx="52" ry="5" fill="var(--color-ink)" opacity="0.08" />
      {name === 'bowl' ? (
        <>
          <path
            d="M32 54h96c0 28-20 48-48 48S32 82 32 54Z"
            fill="var(--color-paper)"
            stroke="var(--color-clay)"
            strokeWidth="3"
          />
          <path d="M44 66c12 6 24-6 36 0s24-6 36 0" stroke="var(--color-glaze)" strokeWidth="2.5" />
          <path
            d="M70 34c-6-8 6-12 0-20M90 34c-6-8 6-12 0-20"
            stroke="var(--color-ash)"
            opacity="0.5"
            strokeWidth="2.5"
          />
        </>
      ) : null}
      {name === 'scroll' ? (
        <>
          <rect
            x="40"
            y="14"
            width="80"
            height="88"
            rx="6"
            fill="var(--color-paper)"
            stroke="var(--color-clay)"
            strokeWidth="3"
          />
          <path d="M54 40h52M54 56h52M54 72h30" stroke="var(--color-glaze)" strokeWidth="3" />
          <circle cx="104" cy="82" r="9" fill="var(--color-seal)" opacity="0.85" />
        </>
      ) : null}
      {name === 'magnifier' ? (
        <>
          <circle
            cx="70"
            cy="52"
            r="30"
            fill="var(--color-paper)"
            stroke="var(--color-clay)"
            strokeWidth="3"
          />
          <path d="M92 74l26 26" stroke="var(--color-clay)" strokeWidth="6" />
          <path d="M58 52h24" stroke="var(--color-glaze)" strokeWidth="3" />
        </>
      ) : null}
      {name === 'bell' ? (
        <>
          <path
            d="M52 82V56c0-16 12-28 28-28s28 12 28 28v26l8 8H44l8-8Z"
            fill="var(--color-paper)"
            stroke="var(--color-clay)"
            strokeWidth="3"
          />
          <path d="M70 98a10 10 0 0 0 20 0" stroke="var(--color-glaze)" strokeWidth="3" />
          <path d="M80 20v8" stroke="var(--color-clay)" strokeWidth="3" />
        </>
      ) : null}
      {name === 'vase' ? (
        <>
          <path
            d="M68 18h24v14c18 8 28 24 28 42 0 18-12 30-40 30S40 92 40 74c0-18 10-34 28-42V18Z"
            fill="var(--color-paper)"
            stroke="var(--color-clay)"
            strokeWidth="3"
          />
          <path d="M48 70c10 6 20-6 32 0s22-6 32 0" stroke="var(--color-glaze)" strokeWidth="3" />
        </>
      ) : null}
    </svg>
  );
}
