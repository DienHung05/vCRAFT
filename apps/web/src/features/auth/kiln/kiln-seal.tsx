import {
  CRACKLE_TILE,
  cn,
  SealMark,
  TRACE_FRAME_INNER_PATH,
  TRACE_FRAME_OUTER_PATH,
  TRACE_FRAME_VIEWBOX,
} from '@vcraft/ui';
import { useId } from 'react';

/**
 * The glowing trace seal of the sign-in scene: the vase seal inside the hand-cut double frame, over a
 * crackle ground, with an ember rim and a halo. 72px, or 240px from `lg` when `large`. Decorative.
 * `data-kiln="hot" | "cool"` on the root brightens or dims the halo (set by `kiln-feedback.ts`).
 */
export function KilnSeal({ large = false, className }: { large?: boolean; className?: string }) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const crackle = `kiln-crackle-${uid}`;
  const rim = `kiln-rim-${uid}`;
  const blurNear = `kiln-blur1-${uid}`;
  const blurFar = `kiln-blur2-${uid}`;
  return (
    <div
      aria-hidden="true"
      data-large={large || undefined}
      className={cn('kiln-seal', large ? 'size-[72px] lg:size-60' : 'size-[72px]', className)}
    >
      <div className="kiln-seal-halo" />
      <div className="kiln-seal-halo kiln-seal-halo-hot" />
      <svg
        aria-hidden="true"
        viewBox={`0 0 ${TRACE_FRAME_VIEWBOX} ${TRACE_FRAME_VIEWBOX}`}
        focusable="false"
        fill="none"
        strokeLinejoin="round"
        className="absolute inset-0 size-full overflow-visible"
      >
        <defs>
          <pattern
            id={crackle}
            width="120"
            height="120"
            patternUnits="userSpaceOnUse"
            patternTransform="scale(.34)"
          >
            <path
              d={CRACKLE_TILE}
              fill="none"
              stroke="var(--color-ink)"
              strokeWidth="1.4"
              strokeLinejoin="round"
              opacity=".2"
            />
          </pattern>
          <linearGradient id={rim} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="rgb(var(--kiln-ember-rgb))" stopOpacity=".3" />
            <stop offset=".55" stopColor="rgb(var(--kiln-ember-rgb))" stopOpacity=".7" />
            <stop offset="1" stopColor="rgb(var(--kiln-hot-rgb))" />
          </linearGradient>
          <filter id={blurNear} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="2.6" />
          </filter>
          <filter id={blurFar} x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="6.5" />
          </filter>
        </defs>
        {/* Ember rim: two blurred strokes (static filters) under the crisp frame. */}
        <path
          d={TRACE_FRAME_OUTER_PATH}
          stroke={`url(#${rim})`}
          strokeWidth="7"
          filter={`url(#${blurFar})`}
          style={{ opacity: 'var(--kiln-rim-o2)' }}
        />
        <path
          d={TRACE_FRAME_OUTER_PATH}
          stroke={`url(#${rim})`}
          strokeWidth="4"
          filter={`url(#${blurNear})`}
          style={{ opacity: 'var(--kiln-rim-o1)' }}
        />
        <path d={TRACE_FRAME_INNER_PATH} fill="var(--kiln-seal-panel)" stroke="none" />
        <path d={TRACE_FRAME_INNER_PATH} fill={`url(#${crackle})`} stroke="none" />
        <path d={TRACE_FRAME_OUTER_PATH} stroke="var(--color-seal)" strokeWidth="2.6" />
        <path d={TRACE_FRAME_INNER_PATH} stroke="var(--color-seal)" strokeWidth="0.9" />
      </svg>
      <SealMark size={100} className="kiln-seal-mark absolute inset-[14%] size-[72%]" />
    </div>
  );
}
