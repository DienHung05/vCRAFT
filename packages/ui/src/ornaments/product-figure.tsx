import { cn } from '../lib/cn';
import { VaseFigure } from './vase-figure';

/** Kinds of pottery a placeholder can show. `generic` is the fallback when nothing else fits. */
export const PRODUCT_FIGURE_KINDS = [
  'bowl',
  'cup',
  'vase',
  'jar',
  'plate',
  'teaset',
  'incense',
  'generic',
] as const;
export type ProductFigureKind = (typeof PRODUCT_FIGURE_KINDS)[number];

export interface ProductFigureProps {
  kind: ProductFigureKind;
  /** Body colour. Defaults to the paper colour. */
  body?: string;
  /** Colour of the wavy band (the blue-and-white wave of the seal). Defaults to the glaze blue. */
  band?: string;
  className?: string;
}

const BAND_WIDTH = 1.5;

interface Shape {
  viewBox: string;
  /** Filled silhouette parts. */
  fills: readonly string[];
  /** Stroked parts (handles) drawn in the body colour. */
  strokes?: readonly string[];
  strokeWidth?: number;
  /** The wave across the body, in the band colour. */
  band: string;
}

/**
 * Flat silhouettes in the style of the vase mark (a solid body with one wavy band), drawn on a 40-unit grid.
 * They are illustrations of a kind of object, not photos of a product.
 */
const SHAPES: Record<Exclude<ProductFigureKind, 'vase'>, Shape> = {
  bowl: {
    viewBox: '0 9 40 32',
    fills: ['M4 14H36C36 25 29.5 32 20 32C10.5 32 4 25 4 14Z', 'M13.5 32.2H26.5L25.2 35.6H14.8Z'],
    band: 'M8.5 20q2.9-3 5.8 0t5.8 0 5.8 0 5.8 0',
  },
  cup: {
    viewBox: '0 4 40 36',
    fills: ['M9 10H27V27.5C27 31.5 24 34 20 34H16C12 34 9 31.5 9 27.5Z'],
    strokes: ['M27 14.5H30C33.5 14.5 35 17 35 20C35 23 33.5 25.5 30 25.5H27'],
    strokeWidth: 2.6,
    band: 'M11.5 21q1.6-2.4 3.2 0t3.2 0 3.2 0 3.2 0',
  },
  jar: {
    viewBox: '0 3 40 34',
    fills: [
      'M10 14H30C33.5 18 34.5 22 34.5 26C34.5 31 31.5 34 27.5 34H12.5C8.5 34 5.5 31 5.5 26C5.5 22 6.5 18 10 14Z',
      'M12 14C12 10.5 15.5 8.5 20 8.5C24.5 8.5 28 10.5 28 14Z',
      'M18.2 5.5H21.8V8.5H18.2Z',
    ],
    band: 'M9.5 24q2.9-3 5.8 0t5.8 0 5.8 0 5.8 0',
  },
  plate: {
    viewBox: '0 10 40 26',
    fills: [
      'M2 17C2 16 3 15.5 4 15.5H36C37 15.5 38 16 38 17C38 21.5 32 25 26.5 26L25 29.5H15L13.5 26C8 25 2 21.5 2 17Z',
    ],
    band: 'M7 20.2q2.7-2.6 5.4 0t5.4 0 5.4 0 5.4 0 5.4 0',
  },
  teaset: {
    viewBox: '0 3 40 34',
    fills: [
      'M5 20C5 15.5 9 13.5 14 13.5C19 13.5 23 15.5 23 20V25.5C23 30 19 32 14 32C9 32 5 30 5 25.5Z',
      'M8.5 13.5C8.5 10.5 11 9 14 9C17 9 19.5 10.5 19.5 13.5Z',
      'M12.4 7.4A1.6 1.6 0 1 1 15.6 7.4A1.6 1.6 0 1 1 12.4 7.4Z',
      'M22.5 19L30 12.5L31.8 14.6L23 24Z',
      'M27 26H37.5C37.5 30.5 34.5 33 32.25 33C30 33 27 30.5 27 26Z',
      'M25.5 33.4H39V34.8H25.5Z',
    ],
    strokes: ['M5.5 17.5C1 17.5 0.5 24.5 5.5 26.5'],
    strokeWidth: 2.4,
    band: 'M7.5 24q1.9-2.2 3.8 0t3.8 0 3.8 0',
  },
  incense: {
    viewBox: '0 3 40 35',
    fills: [
      'M9 13H31C33 20 30 27 25 29H15C10 27 7 20 9 13Z',
      'M6.5 10.5H33.5V13.2H6.5Z',
      'M13 29L10.8 35H15L16.5 29Z',
      'M27 29L29.2 35H25L23.5 29Z',
    ],
    strokes: ['M9.5 14C3.5 13 2.5 8 5.5 6.5', 'M30.5 14C36.5 13 37.5 8 34.5 6.5'],
    strokeWidth: 2.2,
    band: 'M12.5 20q1.9-2.4 3.8 0t3.8 0 3.8 0 3.8 0',
  },
  generic: {
    viewBox: '0 0 40 40',
    fills: ['M12 7H28C31 7 33 9 33 12V28C33 31 31 33 28 33H12C9 33 7 31 7 28V12C7 9 9 7 12 7Z'],
    band: 'M11 20q3-3.2 6 0t6 0 6 0',
  },
};

/**
 * Placeholder illustration of a kind of pottery, for products that have no photo. Decorative (`aria-hidden`):
 * the wrapper that frames it carries the accessible text, which must say that it is an illustration and
 * not a photo of the product.
 */
export function ProductFigure({
  kind,
  body = 'var(--color-paper)',
  band = 'var(--color-glaze)',
  className,
}: ProductFigureProps) {
  if (kind === 'vase') {
    return <VaseFigure body={body} band={band} {...(className !== undefined && { className })} />;
  }
  const shape = SHAPES[kind];
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox={shape.viewBox}
      className={cn('block', className)}
    >
      {shape.fills.map((d) => (
        <path key={d} d={d} fill={body} />
      ))}
      {shape.strokes?.map((d) => (
        <path
          key={d}
          d={d}
          fill="none"
          stroke={body}
          strokeWidth={shape.strokeWidth}
          strokeLinecap="round"
        />
      ))}
      <path
        d={shape.band}
        fill="none"
        stroke={band}
        strokeWidth={BAND_WIDTH}
        strokeLinecap="round"
      />
    </svg>
  );
}
