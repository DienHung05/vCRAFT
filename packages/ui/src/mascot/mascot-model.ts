/**
 * Pure state behind the Fox mascot (BRAND §10, FR-AST-06): mood-to-sprite mapping, gaze direction,
 * and blink timing. No React, so it is unit-tested on its own.
 *
 * The Fox uses the original page-mascot fox sprite sheets (character "fox",
 * https://koboyo.com/page-mascot/mascots/) unchanged — two 3×3 WebP atlases.
 */

export const MASCOT_MOODS = [
  'idle',
  'greet',
  'listen',
  'think',
  'talk',
  'happy',
  'confused',
  'refuse',
  'sleep',
] as const;
export type MascotMood = (typeof MASCOT_MOODS)[number];

// ---------------------------------------------------------------------------
// Directions sheet (fox-directions.webp) — 3×3, row-major
// ---------------------------------------------------------------------------
const DIRECTIONS = [
  'up-left',
  'up',
  'up-right',
  'left',
  'center',
  'right',
  'down-left',
  'down',
  'down-right',
] as const;
export type SpriteDirection = (typeof DIRECTIONS)[number];

// ---------------------------------------------------------------------------
// Reactions sheet (fox-reactions.webp) — 3×3, row-major
// ---------------------------------------------------------------------------
const REACTIONS = [
  'blink',
  'heart',
  'sparkle',
  'surprised',
  'star-eyes',
  'bashful',
  'sleepy',
  'dizzy',
  'delighted',
] as const;
export type SpriteReaction = (typeof REACTIONS)[number];

export function directionIndex(d: SpriteDirection): number {
  return DIRECTIONS.indexOf(d);
}

export function reactionIndex(r: SpriteReaction): number {
  return REACTIONS.indexOf(r);
}

// ---------------------------------------------------------------------------
// Mood -> sprite mapping
// ---------------------------------------------------------------------------

/**
 * When a mood shows a reaction overlay, this is which one.
 * `null` means "use the directions sheet with the current gaze".
 */
const MOOD_REACTION: Record<MascotMood, SpriteReaction | null> = {
  idle: null, // directions (gaze)
  listen: null, // directions (gaze)
  think: null, // directions, but always up-right (overridden in component)
  talk: 'delighted',
  greet: 'heart',
  happy: 'sparkle',
  confused: 'dizzy',
  refuse: null, // directions center + head-shake animation
  sleep: 'sleepy',
};

export function moodReaction(mood: MascotMood): SpriteReaction | null {
  return MOOD_REACTION[mood];
}

/** Fixed direction to use for moods that lock the gaze regardless of pointer. */
const MOOD_FIXED_DIRECTION: Partial<Record<MascotMood, SpriteDirection>> = {
  think: 'up-right',
  refuse: 'center',
};

export function moodFixedDirection(mood: MascotMood): SpriteDirection | null {
  return MOOD_FIXED_DIRECTION[mood] ?? null;
}

/** Whether a mood uses the reactions overlay (vs the directions sheet). */
export function usesReactionOverlay(mood: MascotMood): boolean {
  return MOOD_REACTION[mood] !== null;
}

// ---------------------------------------------------------------------------
// Gaze helpers (used for the nine-direction directions sheet)
// ---------------------------------------------------------------------------

/**
 * Maps a {x,y} gaze step (-1, 0, 1) to the matching SpriteDirection cell.
 * x: -1 = left, 0 = center, 1 = right
 * y: -1 = up,   0 = center, 1 = down
 */
export function gazeToDirection(gaze: { x: -1 | 0 | 1; y: -1 | 0 | 1 }): SpriteDirection {
  if (gaze.y === -1 && gaze.x === -1) return 'up-left';
  if (gaze.y === -1 && gaze.x === 0) return 'up';
  if (gaze.y === -1 && gaze.x === 1) return 'up-right';
  if (gaze.y === 0 && gaze.x === -1) return 'left';
  if (gaze.y === 0 && gaze.x === 1) return 'right';
  if (gaze.y === 1 && gaze.x === -1) return 'down-left';
  if (gaze.y === 1 && gaze.x === 0) return 'down';
  if (gaze.y === 1 && gaze.x === 1) return 'down-right';
  return 'center';
}

/**
 * One of nine head directions toward a point, as a step of -1, 0 or 1 on each axis, from the mascot's
 * centre. Within a dead zone of `deadZone` px on an axis the head looks straight on that axis.
 */
export function gazeDirection(
  centre: { x: number; y: number },
  target: { x: number; y: number } | null,
  deadZone = 48,
): { x: -1 | 0 | 1; y: -1 | 0 | 1 } {
  if (!target) return { x: 0, y: 0 };
  const step = (delta: number): -1 | 0 | 1 =>
    Math.abs(delta) <= deadZone ? 0 : delta < 0 ? -1 : 1;
  return { x: step(target.x - centre.x), y: step(target.y - centre.y) };
}

// ---------------------------------------------------------------------------
// Blink helpers
// ---------------------------------------------------------------------------

/** Whether a mood can blink (eyes are neither always closed nor reacting). */
export function canBlink(mood: MascotMood): boolean {
  // Sleep and greet use overlays where blinking makes no sense.
  return !usesReactionOverlay(mood) && mood !== 'sleep';
}

/** Milliseconds until the next blink: 3–6 s apart (BRAND §10). `random` is injectable for tests. */
export function nextBlinkDelay(random: () => number = Math.random): number {
  return 3_000 + Math.floor(random() * 3_000);
}

/** About one blink in five is a double blink. */
export function isDoubleBlink(random: () => number = Math.random): boolean {
  return random() < 0.2;
}

/** How long a blink keeps the eyes shut (the closed-eye twin of the gaze cell is shown). */
export const BLINK_MS = 120;
/** How long each thought stays before the next one cross-fades in. */
export const THOUGHT_MS = 2_500;
