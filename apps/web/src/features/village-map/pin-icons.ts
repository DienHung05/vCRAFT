import type { MapPinDto } from '@vcraft/contracts';
import type { PinStatus } from './map-model';

/**
 * Marker pins for the village map (GH#216): a teardrop in the status colour with a white glyph for the
 * workshop's purpose, drawn as SVG and handed to MapLibre as an image. Colours follow the brand palette
 * (BRAND.md) and read on both the light and the dark base map thanks to the paper outline.
 */
export const PIN_COLORS: Record<PinStatus, string> = {
  open: '#1e3a6e',
  closed: '#a8482a',
  production: '#6b635a',
};

/** Glyphs on a 24 × 24 grid, centred in the pin's head. */
const GLYPHS: Record<MapPinDto['purpose'], string> = {
  // A vase: the showroom where visitors see the pieces.
  SHOWROOM:
    'M9 4h6v2.2c0 .6.4 1.1.9 1.4C18 8.8 19 10.9 19 13.5 19 17.6 16 20 12 20s-7-2.4-7-6.5c0-2.6 1-4.7 3.1-5.9.5-.3.9-.8.9-1.4Z',
  // A kiln with its flame: where the pieces are made.
  PRODUCTION:
    'M4 20v-8a8 8 0 0 1 16 0v8Zm8-9c-1.6 1.4-2.5 2.8-2.5 4.2a2.5 2.5 0 0 0 5 0c0-1.4-.9-2.8-2.5-4.2Z',
  // A kiln with a vase in front: workshop and showroom in one.
  BOTH: 'M3 20v-7a7 7 0 0 1 12.2-4.7A4.6 4.6 0 0 0 13 12.5c0 2.8 1.5 5.1 3.6 7.5ZM16.5 9h3v1.3c0 .4.2.7.5.9 1.3.8 2 2.1 2 3.8 0 2.7-1.8 5-4 5s-4-2.3-4-5c0-1.7.7-3 2-3.8.3-.2.5-.5.5-.9Z',
};

/** Logical size of the marker in CSS px; the bitmap is drawn at twice that for sharp edges. */
export const PIN_WIDTH = 34;
export const PIN_HEIGHT = 44;

/** The marker as an SVG document: teardrop, paper outline, glyph. The tip is the anchor point. */
export function pinSvg(status: PinStatus, purpose: MapPinDto['purpose']): string {
  const fill = PIN_COLORS[status];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${PIN_WIDTH * 2}" height="${PIN_HEIGHT * 2}" viewBox="0 0 32 42"><path d="M16 41C16 41 3 26.5 3 15.5a13 13 0 0 1 26 0C29 26.5 16 41 16 41Z" fill="${fill}" stroke="#fbf7ef" stroke-width="2"/><g transform="translate(6.4 5.9) scale(.8)"><path d="${GLYPHS[purpose]}" fill="#fbf7ef" fill-rule="evenodd"/></g></svg>`;
}

/** Parses an icon id made by `pinIconId` back into its parts; `null` for any other image id. */
export function parsePinIconId(
  id: string,
): { status: PinStatus; purpose: MapPinDto['purpose'] } | null {
  const match = /^pin-(open|closed|production)-(showroom|production|both)$/.exec(id);
  if (!match) return null;
  return {
    status: match[1] as PinStatus,
    purpose: (match[2] as string).toUpperCase() as MapPinDto['purpose'],
  };
}

/** Rasterises a marker for `map.addImage` (pixel ratio 2). */
export function loadPinImage(id: string): Promise<HTMLImageElement> | null {
  const parts = parsePinIconId(id);
  if (!parts) return null;
  const image = new Image(PIN_WIDTH * 2, PIN_HEIGHT * 2);
  image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(pinSvg(parts.status, parts.purpose))}`;
  return image.decode().then(() => image);
}
