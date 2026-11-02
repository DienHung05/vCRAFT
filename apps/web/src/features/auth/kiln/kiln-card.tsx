import {
  BrushCurl,
  BrushLotus,
  BrushVine,
  BrushWaveBand,
  Crackle,
  cn,
  SEAL_PATH,
  SealMark,
} from '@vcraft/ui';
import { useTranslations } from 'next-intl';
import { type ReactNode, useId } from 'react';
import { KilnSurface } from './kiln-surface';

/** Ink-bleed ring behind the stamped seal (static filter, only painted in the `sealed` state). */
function InkBleed() {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const grad = `kiln-bleed-grad-${uid}`;
  const filter = `kiln-bleed-filter-${uid}`;
  return (
    <svg
      className="kiln-bleed"
      width="190"
      height="190"
      viewBox="0 0 190 190"
      focusable="false"
      aria-hidden="true"
    >
      <defs>
        <radialGradient id={grad}>
          <stop offset="0" stopColor="rgb(var(--kiln-seal-rgb))" stopOpacity=".5" />
          <stop offset=".4" stopColor="rgb(var(--kiln-seal-rgb))" stopOpacity=".26" />
          <stop offset=".64" stopColor="rgb(var(--kiln-seal-rgb))" stopOpacity="0" />
        </radialGradient>
        <filter id={filter} x="-30%" y="-30%" width="160%" height="160%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.035"
            numOctaves="2"
            seed="5"
            result="n"
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="n"
            scale="26"
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>
      </defs>
      <circle cx="95" cy="95" r="95" fill={`url(#${grad})`} filter={`url(#${filter})`} />
    </svg>
  );
}

/**
 * The glazed tile: an opaque surface with a glaze rim and a pointer sheen. `header` (h1 and lead) sits
 * at its top, `children` (the form) below.
 *
 * Later slices drive it through `data-kiln-state` on `.kiln-card`:
 * - `error`: crackle flashes along the edge and the card shakes once (reduced motion: a fade);
 * - `sealed`: the form region fades out, the seal stamps over the card and the success line is announced
 *   (reduced motion: a fade);
 * - `firing`: the submit button glows hot (a button can also carry `data-kiln="firing"`).
 *
 * Brush ornaments hang off the card (behind it): the vine and lotus climb the left edge from `xl` (not on the
 * wide wizard), a curl peeks out of the top right corner and a wave band hangs under it.
 */
export function KilnCard({
  header,
  children,
  wide = false,
  ornaments = true,
}: {
  header?: ReactNode;
  children: ReactNode;
  wide?: boolean;
  ornaments?: boolean;
}) {
  const t = useTranslations('auth.kiln');
  return (
    <div
      className={cn(
        'relative w-full',
        wide ? 'max-w-3xl' : 'max-w-[27.5rem] lg:col-span-5 lg:col-start-8 lg:justify-self-end',
      )}
    >
      {ornaments ? (
        <>
          {wide ? null : (
            <>
              <BrushVine className="top-0 left-0 hidden xl:block" />
              <BrushLotus className="top-0 left-0 hidden xl:block" />
            </>
          )}
          <BrushCurl className={cn('top-0 right-0', wide ? 'block' : 'block lg:hidden')} compact />
          {wide ? null : <BrushCurl className="top-0 right-0 hidden lg:block" />}
          <BrushWaveBand className="top-full left-0" />
        </>
      ) : null}
      <KilnSurface className="kiln-card">
        <div className="kiln-card-in p-5 md:p-8">
          {header ? <header className="flex flex-col gap-2">{header}</header> : null}
          <div className={cn('kiln-card-body', header ? 'mt-5 md:mt-6' : null)}>{children}</div>
        </div>
        <div className="kiln-card-layer kiln-crackle-fade" aria-hidden="true">
          <div className="kiln-crackle">
            <Crackle opacity={1} scale={0.62} strokeWidth={2.3} />
          </div>
        </div>
        <div className="kiln-card-layer kiln-stamp">
          <div className="kiln-stamp-stage" aria-hidden="true">
            <InkBleed />
            <svg
              className="kiln-stamp-ghost"
              viewBox="0 0 40 40"
              width="140"
              height="140"
              fill="none"
              focusable="false"
              aria-hidden="true"
            >
              <path
                d={SEAL_PATH}
                stroke="var(--color-seal)"
                strokeWidth=".7"
                strokeDasharray="1.6 1.4"
              />
            </svg>
            <SealMark size={104} className="kiln-stamp-seal" />
          </div>
          {/* Live region, present from the start so the success line is announced when it is written. */}
          <p
            role="status"
            data-kiln-status=""
            data-text={t('sealed')}
            className="kiln-stamp-line"
          />
        </div>
      </KilnSurface>
    </div>
  );
}
