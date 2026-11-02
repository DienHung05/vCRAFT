/**
 * Collision handling for the hand-drawn village mini map. Pin positions come from real coordinates
 * projected onto a small frame, so neighbouring workshops can land on top of each other (or on each
 * other's labels). The map is only for orientation, so we nudge pins apart a little and pick the
 * label side (below, above, right, left) that collides with the least. Pure function of the frame
 * size, the pins and the measured label widths; all values are pixels inside the frame.
 */

export interface LayoutPinInput {
  id: string;
  /** Pin centre as a percentage of the frame. */
  x: number;
  y: number;
  /** Icon edge length in px. */
  size: number;
  /** Rendered label width in px. */
  labelWidth: number;
}

export interface PlacedPin {
  /** Pin centre in px. */
  cx: number;
  cy: number;
  /** Label top-left corner in px, in frame coordinates. */
  labelLeft: number;
  labelTop: number;
}

interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export const LABEL_HEIGHT = 20;
export const LABEL_GAP = 4;
const FRAME_INSET = 2;
/** Air kept between two boxes when counting a collision. */
const CLEARANCE = 2;
const BASE_PIN_PAD = 4;
const MAX_ATTEMPTS = 8;
const NEIGHBOUR_RANGE = 12;
const NEIGHBOUR_WEIGHT = 0.05;

const overlapArea = (a: Rect, b: Rect): number => {
  const w =
    Math.min(a.left + a.width + CLEARANCE, b.left + b.width) - Math.max(a.left - CLEARANCE, b.left);
  const h =
    Math.min(a.top + a.height + CLEARANCE, b.top + b.height) - Math.max(a.top - CLEARANCE, b.top);
  return w > 0 && h > 0 ? w * h : 0;
};

/** Area of a box that falls outside the frame (labels must stay readable). */
const outsideArea = (r: Rect, frame: { width: number; height: number }): number => {
  const w = Math.min(r.left + r.width, frame.width) - Math.max(r.left, 0);
  const h = Math.min(r.top + r.height, frame.height) - Math.max(r.top, 0);
  const inside = w > 0 && h > 0 ? w * h : 0;
  return r.width * r.height - inside;
};

const inflate = (r: Rect, by: number): Rect => ({
  left: r.left - by,
  top: r.top - by,
  width: r.width + 2 * by,
  height: r.height + 2 * by,
});

const pinRect = (cx: number, cy: number, size: number): Rect => ({
  left: cx - size / 2,
  top: cy - size / 2,
  width: size,
  height: size,
});

/**
 * Label boxes in preference order: below the pin, above, to the right, to the left, then the four
 * diagonals (label hanging off a corner of the pin) for crowded spots.
 */
function candidates(
  cx: number,
  cy: number,
  size: number,
  width: number,
  frame: { width: number },
): Rect[] {
  const clampX = (left: number) =>
    Math.max(FRAME_INSET, Math.min(left, frame.width - width - FRAME_INSET));
  const box = (left: number, top: number): Rect => ({ left, top, width, height: LABEL_HEIGHT });
  return [
    box(clampX(cx - width / 2), cy + size / 2 + LABEL_GAP),
    box(clampX(cx - width / 2), cy - size / 2 - LABEL_GAP - LABEL_HEIGHT),
    box(cx + size / 2 + LABEL_GAP, cy - LABEL_HEIGHT / 2),
    box(cx - size / 2 - LABEL_GAP - width, cy - LABEL_HEIGHT / 2),
    box(cx + size / 2 + LABEL_GAP, cy + size / 2 + LABEL_GAP - LABEL_HEIGHT / 2),
    box(cx - size / 2 - LABEL_GAP - width, cy + size / 2 + LABEL_GAP - LABEL_HEIGHT / 2),
    box(cx + size / 2 + LABEL_GAP, cy - size / 2 - LABEL_GAP - LABEL_HEIGHT / 2),
    box(cx - size / 2 - LABEL_GAP - width, cy - size / 2 - LABEL_GAP - LABEL_HEIGHT / 2),
  ];
}

/** Pushes overlapping pins apart (pairwise, along the line between them) and keeps them in the frame. */
function separate(
  start: readonly { x: number; y: number }[],
  sizes: readonly number[],
  pad: number,
  frame: { width: number; height: number },
): { x: number; y: number }[] {
  const pts = start.map((p) => ({ ...p }));
  for (let iteration = 0; iteration < 80; iteration++) {
    let moved = false;
    for (let i = 0; i < pts.length; i++) {
      for (let j = i + 1; j < pts.length; j++) {
        const a = pts[i];
        const b = pts[j];
        if (!a || !b) continue;
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        let dist = Math.hypot(dx, dy);
        const min = ((sizes[i] ?? 0) + (sizes[j] ?? 0)) / 2 + pad;
        if (dist >= min) continue;
        if (dist < 0.01) {
          // Identical spots: spread horizontally, in index order, so the result is deterministic.
          dx = 1;
          dy = 0;
          dist = 1;
        }
        const push = (min - dist) / 2;
        a.x -= (dx / dist) * push;
        a.y -= (dy / dist) * push;
        b.x += (dx / dist) * push;
        b.y += (dy / dist) * push;
        moved = true;
      }
    }
    pts.forEach((p, i) => {
      const half = (sizes[i] ?? 0) / 2 + FRAME_INSET;
      p.x = Math.max(half, Math.min(p.x, frame.width - half));
      p.y = Math.max(half, Math.min(p.y, frame.height - half));
    });
    if (!moved) break;
  }
  return pts;
}

interface Attempt {
  cost: number;
  placed: PlacedPin[];
}

function place(
  centres: readonly { x: number; y: number }[],
  pins: readonly LayoutPinInput[],
  frame: { width: number; height: number },
): Attempt {
  const icons = pins.map((p, i) => pinRect(centres[i]?.x ?? 0, centres[i]?.y ?? 0, p.size));
  const options = pins.map((p, i) =>
    candidates(centres[i]?.x ?? 0, centres[i]?.y ?? 0, p.size, p.labelWidth, frame),
  );
  const choice = pins.map(() => -1);

  const costOf = (i: number, rect: Rect): number => {
    let cost = outsideArea(rect, frame) * 10;
    icons.forEach((icon, j) => {
      if (j === i) return;
      cost += overlapArea(rect, icon);
      // Soft penalty for hugging another pin, so a label stays visibly closest to its own pin.
      cost += NEIGHBOUR_WEIGHT * overlapArea(rect, inflate(icon, NEIGHBOUR_RANGE));
    });
    options.forEach((opts, j) => {
      const other = j === i ? undefined : opts[choice[j] ?? -1];
      if (other) cost += overlapArea(rect, other);
    });
    return cost;
  };

  // Greedy first pass, then two refinement passes now that every other label has a side.
  for (let pass = 0; pass < 6; pass++) {
    pins.forEach((_, i) => {
      let best = 0;
      let bestCost = Number.POSITIVE_INFINITY;
      (options[i] ?? []).forEach((rect, k) => {
        // Tiny preference for earlier candidates keeps "below" as the default.
        const cost = costOf(i, rect) + k * 0.001;
        if (cost < bestCost) {
          best = k;
          bestCost = cost;
        }
      });
      choice[i] = best;
    });
  }

  let cost = 0;
  const placed = pins.map((_, i): PlacedPin => {
    const rect = options[i]?.[choice[i] ?? 0] ?? { left: 0, top: 0, width: 0, height: 0 };
    cost += outsideArea(rect, frame) * 10;
    for (let j = i + 1; j < pins.length; j++) {
      const iconJ = icons[j];
      const iconI = icons[i];
      const rectJ = options[j]?.[choice[j] ?? 0];
      if (iconJ) cost += overlapArea(rect, iconJ);
      if (rectJ) cost += overlapArea(rect, rectJ);
      if (iconI && rectJ) cost += overlapArea(rectJ, iconI);
      if (iconI && iconJ) cost += overlapArea(iconI, iconJ);
    }
    return {
      cx: centres[i]?.x ?? 0,
      cy: centres[i]?.y ?? 0,
      labelLeft: rect.left,
      labelTop: rect.top,
    };
  });
  return { cost, placed };
}

/**
 * Lays the pins out inside a frame of the given size. Tries progressively larger pin spacing until
 * no pin or label overlaps another; returns the least-colliding attempt if the frame is too small.
 */
export function layoutMiniMap(
  pins: readonly LayoutPinInput[],
  frame: { width: number; height: number },
): Map<string, PlacedPin> {
  const start = pins.map((p) => ({ x: (p.x / 100) * frame.width, y: (p.y / 100) * frame.height }));
  const sizes = pins.map((p) => p.size);
  let best: Attempt | undefined;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const centres = separate(start, sizes, BASE_PIN_PAD + attempt * 6, frame);
    const result = place(centres, pins, frame);
    if (!best || result.cost < best.cost) best = result;
    if (result.cost === 0) break;
  }
  return new Map(pins.map((p, i) => [p.id, best?.placed[i] as PlacedPin]));
}
