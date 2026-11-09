import { cn } from '@vcraft/ui';
import { PIECE_SHAPES, type PieceKind } from './piece-shapes';

/**
 * The piece taking shape (GH#300), drawn as stacked SVG layers. It carries no state: the stage in focus is the
 * `data-piece-stage` attribute of an ancestor (see `.piece` rules in globals.css), which fades, scales and
 * clip-reveals the layers with transform, opacity and clip-path only. Rendered on the server, so the final
 * illustration shows without any script.
 */
export function PieceFigure({
  kind,
  glaze,
  className,
}: {
  kind: PieceKind;
  /** Glaze colour of the finished piece. */
  glaze: string;
  className?: string;
}) {
  const shape = PIECE_SHAPES[kind];
  const lumpY = 212 - shape.lump.ry * 0.9;
  return (
    <div
      className={cn('piece', className)}
      style={{ '--piece-glaze': glaze } as React.CSSProperties}
    >
      <span
        aria-hidden="true"
        className="piece-halo"
        style={{ top: `${(shape.glowY / 240) * 100}%` }}
      />
      <svg
        viewBox="0 0 200 240"
        aria-hidden="true"
        focusable="false"
        className="piece-svg"
        width="200"
        height="240"
      >
        <ellipse className="piece-ground" cx="100" cy="218" rx="78" ry="8" />
        <g className="piece-layer piece-lump">
          <ellipse cx="100" cy={lumpY} rx={shape.lump.rx} ry={shape.lump.ry} />
        </g>
        <g className="piece-layer piece-wet">
          <path d={shape.body} />
          {shape.handle ? <path className="piece-handle" d={shape.handle} /> : null}
        </g>
        <g className="piece-layer piece-dry">
          <path d={shape.body} />
          {shape.handle ? <path className="piece-handle" d={shape.handle} /> : null}
        </g>
        <g className="piece-layer piece-glaze">
          <path d={shape.body} />
          {shape.handle ? <path className="piece-handle" d={shape.handle} /> : null}
        </g>
        <g className="piece-layer piece-wave">
          <path d={shape.wave} />
        </g>
        <g className="piece-layer piece-glow">
          <path d={shape.body} />
          {shape.handle ? <path className="piece-handle" d={shape.handle} /> : null}
        </g>
        <g className="piece-layer piece-sheen">
          <path d={shape.sheen} />
        </g>
      </svg>
    </div>
  );
}
