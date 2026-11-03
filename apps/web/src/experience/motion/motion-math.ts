/**
 * Pure helpers behind the signature motion moments (PLAN E13, BRAND §6.3, GH#95), tested without a
 * browser: count-up easing, the magnetic pull of a button, and the horizontal distance of the day story.
 */

/** Ease-out cubic: fast start, gentle landing, like a number settling. */
export const easeOutCubic = (t: number) => 1 - (1 - Math.min(1, Math.max(0, t))) ** 3;

/** The value a count-up shows `elapsed` ms into a `duration` ms run towards `target`. */
export function countUpValue(target: number, elapsed: number, duration: number): number {
  if (duration <= 0) return target;
  return Math.round(target * easeOutCubic(elapsed / duration));
}

/** Splits a displayed figure ("1.234", "700+") into its number and the text around it. */
export function parseFigure(
  text: string,
): { prefix: string; value: number; suffix: string } | null {
  const match = /^(\D*?)(\d[\d.,\s]*)(\D*)$/.exec(text.trim());
  if (!match) return null;
  const value = Number((match[2] ?? '').replace(/[.,\s]/g, ''));
  return Number.isFinite(value) ? { prefix: match[1] ?? '', value, suffix: match[3] ?? '' } : null;
}

/**
 * How far a magnetic button leans towards the pointer: a fraction of the offset from its centre, capped
 * so it never travels more than `max` px.
 */
export function magneticOffset(
  pointer: { x: number; y: number },
  box: { left: number; top: number; width: number; height: number },
  strength = 0.25,
  max = 8,
): { x: number; y: number } {
  const dx = (pointer.x - (box.left + box.width / 2)) * strength;
  const dy = (pointer.y - (box.top + box.height / 2)) * strength;
  const length = Math.hypot(dx, dy);
  const scale = length > max ? max / length : 1;
  return { x: dx * scale, y: dy * scale };
}

/** How far the day story's strip moves sideways: its overflow beyond the viewport, never negative. */
export const storyDistance = (stripWidth: number, viewportWidth: number) =>
  Math.max(0, stripWidth - viewportWidth);
