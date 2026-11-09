import { silhouette, VIEW } from './silhouette';

/** One motif period in viewBox units; must match the `turning-vase-spin` keyframes in globals.css. */
const PERIOD = 80;
/** Five periods cover the widest body (about 256 units) plus one period of travel. */
const MOTIFS = Array.from({ length: 5 }, (_, i) => 40 + i * PERIOD);

// BRAND 3.1, the same colours as the 3D glaze: ivory ground and the cobalt of men lam.
const IVORY = '#f1ebdd';
const COBALT = '#1e3a6e';
const SHADE = 'rgb(10 20 50)';

const geometry = silhouette();

/**
 * The hero vase for first paint (GH#316): the same finished money jar the WebGL scene ends on, drawn from
 * the same profile data, shaded like the scene's light (from the upper right) and turning on a CSS loop.
 * Server-rendered, so it is in the first HTML and plays without JavaScript; the 3D canvas fades in over
 * it once it has drawn a frame. Decorative: the hero frame carries the alt text.
 */
export function TurningVase({ className }: { className?: string }) {
  const { path, rings, centreX, footY, topY, lipRadius } = geometry;
  // Motif zone between the foot band and the shoulder band, in viewBox units.
  const bodyTop = topY + 60;
  const bodyBottom = footY - 28;
  const bandY = [topY + 34, footY - 52];
  return (
    <svg
      viewBox={`0 0 ${VIEW.width} ${VIEW.height}`}
      preserveAspectRatio="xMidYMid meet"
      className={className}
      aria-hidden="true"
      focusable="false"
      data-testid="turning-vase"
    >
      <defs>
        <clipPath id="turning-vase-clip">
          <path d={path} />
        </clipPath>
        <linearGradient id="turning-vase-shade" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor={SHADE} stopOpacity="0.62" />
          <stop offset="0.22" stopColor={SHADE} stopOpacity="0.2" />
          <stop offset="0.5" stopColor={SHADE} stopOpacity="0" />
          <stop offset="0.68" stopColor="#fff" stopOpacity="0.22" />
          <stop offset="0.8" stopColor={SHADE} stopOpacity="0.04" />
          <stop offset="1" stopColor={SHADE} stopOpacity="0.55" />
        </linearGradient>
        <linearGradient id="turning-vase-glint-grad" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#fff" stopOpacity="0" />
          <stop offset="0.5" stopColor="#fff" stopOpacity="0.5" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <radialGradient id="turning-vase-floor" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor={SHADE} stopOpacity="0.38" />
          <stop offset="1" stopColor={SHADE} stopOpacity="0" />
        </radialGradient>
      </defs>
      {/* Soft shadow on the floor under the foot. */}
      <ellipse
        cx={centreX + 14}
        cy={footY + 4}
        rx={lipRadius * 4.2}
        ry="16"
        fill="url(#turning-vase-floor)"
      />
      <g clipPath="url(#turning-vase-clip)">
        <rect x="0" y="0" width={VIEW.width} height={VIEW.height} fill={IVORY} />
        {/* Glaze motifs slide left, one period per loop. */}
        <g className="turning-vase-spin">
          {MOTIFS.map((x) => (
            <g key={x} fill="none" stroke={COBALT} strokeLinecap="round">
              <path
                d={`M${x} ${bodyBottom} C${x - 20} ${bodyBottom - 50} ${x - 20} ${bodyTop + 50} ${x} ${bodyTop}`}
                strokeWidth="5"
                opacity="0.9"
              />
              <path
                d={`M${x} ${bodyBottom} C${x + 20} ${bodyBottom - 50} ${x + 20} ${bodyTop + 50} ${x} ${bodyTop}`}
                strokeWidth="5"
                opacity="0.9"
              />
              <circle cx={x + PERIOD / 2} cy={(bodyTop + bodyBottom) / 2} r="6" fill={COBALT} />
            </g>
          ))}
        </g>
        {/* Cobalt bands at the shoulder and the foot stay put, as rings do on a turning pot. */}
        {bandY.map((y) => (
          <rect key={y} x="0" y={y} width={VIEW.width} height="10" fill={COBALT} opacity="0.92" />
        ))}
        {/* Light from the upper right, shaded ring by ring across each ring's own width. */}
        {rings.map((ring) => {
          const rMax = Math.max(ring.r0, ring.r1);
          return (
            <rect
              key={ring.y1}
              x={centreX - rMax}
              y={ring.y1 - 0.6}
              width={rMax * 2}
              height={ring.y0 - ring.y1 + 1.2}
              fill="url(#turning-vase-shade)"
            />
          );
        })}
        {/* A glint that glides across the glaze as the vase turns. */}
        <rect
          className="turning-vase-glint"
          x={centreX - 14}
          y={topY}
          width="28"
          height={footY - topY}
          fill="url(#turning-vase-glint-grad)"
        />
      </g>
      {/* The opening: a dark ellipse at the lip. */}
      <ellipse cx={centreX} cy={topY + 1} rx={lipRadius} ry={lipRadius * 0.22} fill={COBALT} />
      <ellipse
        cx={centreX}
        cy={topY + 1}
        rx={lipRadius}
        ry={lipRadius * 0.22}
        fill="none"
        stroke="#fff"
        strokeOpacity="0.35"
      />
    </svg>
  );
}
