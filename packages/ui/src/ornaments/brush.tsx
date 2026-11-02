import { type CSSProperties, useId } from 'react';
import { cn } from '../lib/cn';
import {
  type BrushMotif,
  CURL_COMPACT_MOTIF,
  CURL_MOTIF,
  LOTUS_MOTIF,
  VINE_MOTIF,
  WAVE_BAND_MOTIF,
} from './brush-geometry';

export interface BrushOrnamentProps {
  /**
   * Positions the ornament: it is a 1px anchor with visible overflow, so place its corner on the
   * host box (`right-0 top-0` etc.). The host must be `relative`.
   */
  className?: string;
}

/** Strips characters that would break `url(#id)`; React's `useId` can contain `:` or `«»`. */
function safeId(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9_-]/g, '');
}

/** Stagger step (40ms units) as a custom property read by `.brush-draw` (theme.css). */
function step(i: number): CSSProperties {
  return { ['--brush-i' as string]: i };
}

/**
 * Renders one hoa lam brush motif. Every filled press is revealed by a mask whose centreline stroke
 * animates `stroke-dashoffset` (`.brush-draw`, theme.css): ease.clay, dur.story, 40ms stagger. With
 * reduced motion the art is fully drawn and only fades in. The roughening filter is static.
 */
function BrushMotifArt({
  motif,
  className,
  fade,
}: {
  motif: BrushMotif;
  className: string | undefined;
  /** Fades the left end of the art out (wave band). */
  fade?: boolean;
}) {
  const uid = safeId(useId());
  const maskId = `brush-mask-${uid}`;
  const filterId = `brush-rough-${uid}`;
  const fadeId = `brush-fade-${uid}`;
  const gradId = `brush-grad-${uid}`;
  const [bx, by, bw, bh] = motif.box;
  const shapeProps = { fill: 'currentColor' } as const;
  const maskProps = {
    fill: 'none',
    stroke: '#fff',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    pathLength: 1,
    className: 'brush-draw',
  } as const;

  return (
    <svg
      aria-hidden="true"
      focusable="false"
      className={cn(
        'brush-orn pointer-events-none absolute size-px overflow-visible text-glaze',
        className,
      )}
    >
      <defs>
        <filter
          id={filterId}
          filterUnits="userSpaceOnUse"
          x={bx}
          y={by}
          width={bw}
          height={bh}
          colorInterpolationFilters="sRGB"
        >
          {/* Edge wobble, then a few pits where the ink did not take (as the comp's rough brush). */}
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.035"
            numOctaves="1"
            seed={motif.turbulenceSeed}
            result="w"
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="w"
            scale={motif.roughness}
            xChannelSelector="R"
            yChannelSelector="G"
            result="d"
          />
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.55"
            numOctaves="1"
            seed={motif.turbulenceSeed + 5}
            result="s"
          />
          <feColorMatrix
            in="s"
            type="matrix"
            values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -9 6.3"
            result="holes"
          />
          <feComposite in="d" in2="holes" operator="in" />
        </filter>
        <mask id={maskId} maskUnits="userSpaceOnUse" x={bx} y={by} width={bw} height={bh}>
          {[...motif.wash, ...motif.solid].map((s) => (
            <path
              key={`${s.i}-${s.c.slice(0, 24)}-${s.w}`}
              d={s.c}
              strokeWidth={s.w}
              style={step(s.i)}
              {...maskProps}
            />
          ))}
          {motif.lines?.map((l) => (
            <path
              key={l.d.slice(0, 32)}
              d={l.d}
              strokeWidth={l.sw + 8}
              style={step(l.i)}
              {...maskProps}
            />
          ))}
        </mask>
        {fade ? (
          <>
            <linearGradient
              id={gradId}
              gradientUnits="userSpaceOnUse"
              x1={bx}
              y1="0"
              x2={bx + bw}
              y2="0"
            >
              <stop offset="0" stopColor="#fff" stopOpacity="0" />
              <stop offset=".22" stopColor="#fff" />
              <stop offset="1" stopColor="#fff" />
            </linearGradient>
            <mask id={fadeId} maskUnits="userSpaceOnUse" x={bx} y={by} width={bw} height={bh}>
              <rect x={bx} y={by} width={bw} height={bh} fill={`url(#${gradId})`} />
            </mask>
          </>
        ) : null}
      </defs>
      <g mask={fade ? `url(#${fadeId})` : undefined}>
        <g mask={`url(#${maskId})`}>
          {motif.wash.length > 0 ? (
            <g style={{ opacity: 'var(--brush-wash-opacity, 0.24)' }}>
              {motif.wash.map((s) => (
                <path key={`${s.i}-${s.d.slice(0, 24)}`} d={s.d} {...shapeProps} />
              ))}
            </g>
          ) : null}
          <g filter={`url(#${filterId})`} style={{ opacity: 'var(--brush-ink-opacity, 0.82)' }}>
            {motif.solid.map((s) => (
              <path key={`${s.i}-${s.d.slice(0, 24)}`} d={s.d} {...shapeProps} />
            ))}
            {motif.lines?.map((l) => (
              <path
                key={l.d.slice(0, 32)}
                d={l.d}
                fill="none"
                stroke="currentColor"
                strokeWidth={l.sw}
                strokeLinecap="round"
                opacity={l.o}
              />
            ))}
          </g>
        </g>
        {motif.dots.length > 0 ? (
          <g
            className="brush-dots"
            style={{ opacity: 'var(--brush-ink-opacity, 0.82)' }}
            {...shapeProps}
          >
            {motif.dots.map(([x, y, r]) => (
              <circle key={`${x}-${y}`} cx={x} cy={y} r={r} />
            ))}
          </g>
        ) : null}
      </g>
    </svg>
  );
}

/** Hoa lam vine climbing the left edge of the host box, curling past its top-left corner. */
export function BrushVine({ className }: BrushOrnamentProps) {
  return <BrushMotifArt motif={VINE_MOTIF} className={className} />;
}

/** Hoa lam lotus bloom set in the vine's scroll. Same origin as `BrushVine` (host top-left). */
export function BrushLotus({ className }: BrushOrnamentProps) {
  return <BrushMotifArt motif={LOTUS_MOTIF} className={className} />;
}

export interface BrushCurlProps extends BrushOrnamentProps {
  /** Larger curl that arches over the top edge, for narrow hosts. */
  compact?: boolean;
}

/** Scroll curl peeking out behind the host's top-right corner. */
export function BrushCurl({ className, compact = false }: BrushCurlProps) {
  return <BrushMotifArt motif={compact ? CURL_COMPACT_MOTIF : CURL_MOTIF} className={className} />;
}

/**
 * Brush-pressed wave band (the comp's version of `WaveDivider`) hanging under the host box, fading
 * out to the left. Origin: host bottom-left; place with `left-0 top-full`.
 */
export function BrushWaveBand({ className }: BrushOrnamentProps) {
  return <BrushMotifArt motif={WAVE_BAND_MOTIF} className={className} fade />;
}
