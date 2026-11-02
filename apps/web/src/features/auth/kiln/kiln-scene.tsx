import { useId } from 'react';
import { EMBERS_FAR, EMBERS_MID, EMBERS_NEAR, type Ember } from './embers';

function Dots({ dots, fill }: { dots: readonly Ember[]; fill?: string }) {
  return dots.map(([x, y, r, opacity, colour]) => (
    <circle
      key={`${x}-${y}`}
      cx={`${x}%`}
      cy={`${y}%`}
      r={r}
      opacity={opacity}
      className={fill ? undefined : `e${colour}`}
      fill={fill}
    />
  ));
}

/**
 * The static kiln scene: heat-shimmer bands and about forty ember dots over the CSS glow painted by
 * `.kiln-scene`. Three stacked SVG layers (each drifts slowly as one compositor transform) and no
 * filters. It is also the fallback art when WebGL is off or motion is reduced. Purely decorative.
 */
export function KilnScene() {
  const glow = `kiln-glow-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0">
      <div className="kiln-shimmer" />
      <svg aria-hidden="true" className="kiln-embers" data-layer="far" focusable="false">
        <Dots dots={EMBERS_FAR} />
      </svg>
      <svg aria-hidden="true" className="kiln-embers" data-layer="mid" focusable="false">
        <defs>
          <radialGradient id={glow}>
            <stop offset="0" className="kiln-stop-hot" stopOpacity="0.95" />
            <stop offset="0.45" className="kiln-stop-ember" stopOpacity="0.45" />
            <stop offset="1" className="kiln-stop-ember" stopOpacity="0" />
          </radialGradient>
        </defs>
        <Dots dots={EMBERS_MID} fill={`url(#${glow})`} />
      </svg>
      <svg aria-hidden="true" className="kiln-embers" data-layer="near" focusable="false">
        <Dots dots={EMBERS_NEAR} />
      </svg>
    </div>
  );
}
