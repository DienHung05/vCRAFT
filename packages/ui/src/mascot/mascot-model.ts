/**
 * Pure state behind the Fox mascot (BRAND §10, FR-AST-06): what the face shows for each mood, where the
 * head turns, and when it blinks. No React, so it is unit-tested on its own.
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

export type EyeShape = 'open' | 'closed' | 'happy' | 'wide' | 'up';
export type MouthShape = 'smile' | 'open' | 'flat' | 'o' | 'wobble';
/** Something the Fox does besides its face. */
export type MascotGesture = 'wave' | 'zzz' | 'question' | 'shake' | 'hug' | null;

export interface MascotFace {
  eyes: EyeShape;
  mouth: MouthShape;
  gesture: MascotGesture;
  /** Ears pricked forward (listening) or folded back (refusing). */
  ears: 'up' | 'forward' | 'back';
}

const FACES: Record<MascotMood, MascotFace> = {
  idle: { eyes: 'open', mouth: 'smile', gesture: null, ears: 'up' },
  greet: { eyes: 'happy', mouth: 'open', gesture: 'wave', ears: 'up' },
  listen: { eyes: 'wide', mouth: 'flat', gesture: null, ears: 'forward' },
  think: { eyes: 'up', mouth: 'flat', gesture: null, ears: 'up' },
  talk: { eyes: 'open', mouth: 'open', gesture: null, ears: 'up' },
  happy: { eyes: 'happy', mouth: 'smile', gesture: null, ears: 'up' },
  confused: { eyes: 'wide', mouth: 'wobble', gesture: 'question', ears: 'up' },
  // Shakes its head and holds the vase tight.
  refuse: { eyes: 'closed', mouth: 'flat', gesture: 'hug', ears: 'back' },
  sleep: { eyes: 'closed', mouth: 'o', gesture: 'zzz', ears: 'back' },
};

export function mascotFace(mood: MascotMood): MascotFace {
  return FACES[mood];
}

/** Whether a mood's eyes are open, so a blink means something. */
export function canBlink(mood: MascotMood): boolean {
  const { eyes } = FACES[mood];
  return eyes !== 'closed' && eyes !== 'happy';
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

/** Milliseconds until the next blink: 3–6 s apart (BRAND §10). `random` is injectable for tests. */
export function nextBlinkDelay(random: () => number = Math.random): number {
  return 3_000 + Math.floor(random() * 3_000);
}

/** About one blink in five is a double blink. */
export function isDoubleBlink(random: () => number = Math.random): boolean {
  return random() < 0.2;
}

/** How long a blink keeps the eyes shut. */
export const BLINK_MS = 120;
/** How long each thought stays before the next one cross-fades in. */
export const THOUGHT_MS = 2_500;
