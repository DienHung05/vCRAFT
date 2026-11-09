import type { ProductFigureKind } from '@vcraft/ui';
import { presetKindOf } from '@/features/catalog/preset-figure';

/** The shapes the journey illustration can draw, one silhouette each. `other` is the squat pot fallback. */
export const PIECE_KINDS = ['bowl', 'vase', 'cup', 'plate', 'jar', 'other'] as const;
export type PieceKind = (typeof PIECE_KINDS)[number];

/** Which silhouette stands in for a placeholder figure kind: an incense burner is a jar, a tea set is not one shape. */
export function pieceKindOfFigure(kind: ProductFigureKind): PieceKind {
  switch (kind) {
    case 'bowl':
    case 'vase':
    case 'cup':
    case 'plate':
    case 'jar':
      return kind;
    case 'incense':
      return 'jar';
    default:
      return 'other';
  }
}

/** The silhouette for a product, chosen from its category and name exactly as the placeholder figure is. */
export function pieceKindOf(category: string | undefined, name: string): PieceKind {
  return pieceKindOfFigure(presetKindOf(category, name));
}

export interface PieceShape {
  /** Closed body silhouette, symmetrical about x = 100, standing on the ground line y = 212 (viewBox 200 x 240). */
  body: string;
  /** Stroked handle, drawn in the body colour (cups only). */
  handle?: string;
  /** The painted wave across the belly. */
  wave: string;
  /** A highlight stroke on the lit side of the finished glaze. */
  sheen: string;
  /** The lump of raw clay before the piece is shaped. */
  lump: { rx: number; ry: number };
  /** Vertical centre of the kiln glow behind the piece. */
  glowY: number;
}

/** Flat silhouettes on a 200 x 240 grid. They illustrate a kind of object, never a claim about one product. */
export const PIECE_SHAPES: Record<PieceKind, PieceShape> = {
  vase: {
    sheen: 'M72 120q-6 26-2 50',
    body: 'M82 34H118L116 62C116 82 134 104 140 134C146 166 134 196 124 204C122 208 120 212 116 212H84C80 212 78 208 76 204C66 196 54 166 60 134C66 104 84 82 84 62Z',
    wave: 'M66 150q8.5-9 17 0t17 0t17 0t17 0',
    lump: { rx: 44, ry: 38 },
    glowY: 130,
  },
  bowl: {
    sheen: 'M46 134q2 18 14 32',
    body: 'M30 120H170C170 164 146 196 120 202L118 212H82L80 202C54 196 30 164 30 120Z',
    wave: 'M49 146q8.5-9 17 0t17 0t17 0t17 0t17 0',
    lump: { rx: 54, ry: 34 },
    glowY: 160,
  },
  cup: {
    sheen: 'M76 124q-2 26 2 52',
    body: 'M64 110H136L130 190C129 204 120 212 108 212H92C80 212 71 204 70 190Z',
    handle: 'M136 128H146C162 128 162 172 146 172H133',
    wave: 'M72 150q7-8 14 0t14 0t14 0t14 0',
    lump: { rx: 40, ry: 36 },
    glowY: 160,
  },
  plate: {
    sheen: 'M40 172q10 10 22 14',
    body: 'M12 164C12 164 24 184 58 192L68 212H132L142 192C176 184 188 164 188 164Z',
    wave: 'M52 180q9.5-8 19 0t19 0t19 0t19 0t19 0',
    lump: { rx: 60, ry: 26 },
    glowY: 190,
  },
  jar: {
    sheen: 'M52 130q-8 20-6 44',
    body: 'M76 62H124L122 82C150 94 168 124 168 158C168 190 148 212 120 212H80C52 212 32 190 32 158C32 124 50 94 78 82Z',
    wave: 'M50 156q10-10 20 0t20 0t20 0t20 0t20 0',
    lump: { rx: 52, ry: 42 },
    glowY: 150,
  },
  other: {
    sheen: 'M52 130q-8 16-8 34',
    body: 'M70 96H130L134 112C164 122 172 150 168 172C164 196 142 212 118 212H82C58 212 36 196 32 172C28 150 36 122 66 112Z',
    wave: 'M52 170q10-9 20 0t20 0t20 0t20 0t20 0',
    lump: { rx: 50, ry: 40 },
    glowY: 160,
  },
};
