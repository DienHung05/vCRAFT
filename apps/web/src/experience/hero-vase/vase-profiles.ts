/**
 * The hero vase's silhouettes (PLAN E13, BRAND §6.3 #1): four Bát Tràng shapes the vase turns through as
 * the visitor scrolls, from a lump of clay to a finished money jar. Each profile is the right half of
 * the outline, as (radius, height) pairs from foot to lip, sampled at the same heights so any two can be
 * blended point by point. Pure maths, unit-tested without WebGL.
 */

export type Profile = readonly (readonly [radius: number, height: number])[];

/** Heights shared by every profile: 0 (foot) to 2 (lip). */
const HEIGHTS = Array.from({ length: 25 }, (_, i) => (i / 24) * 2);

/** Builds a profile from a radius function of the normalised height (0 foot … 1 lip). */
function shape(radius: (h: number) => number): Profile {
  return HEIGHTS.map((y) => [Math.max(0.02, radius(y / 2)), y] as const);
}

const bump = (h: number, centre: number, width: number) => Math.exp(-(((h - centre) / width) ** 2));

export const PROFILES: readonly Profile[] = [
  // 1. Clay on the wheel: a squat, soft dome.
  shape((h) => 0.55 + 0.25 * bump(h, 0.35, 0.45) - 0.35 * h * h),
  // 2. Thrown cylinder, still straight-walled.
  shape((h) => 0.42 + 0.04 * bump(h, 0.5, 0.3) - 0.04 * h),
  // 3. Bình tỳ bà: round belly, slim neck, flared lip.
  shape((h) => 0.2 + 0.42 * bump(h, 0.33, 0.24) + 0.12 * bump(h, 1, 0.08) - 0.06 * h),
  // 4. Bình hút lộc (money jar): broad shoulder, short neck, small rolled lip.
  shape((h) => 0.24 + 0.5 * bump(h, 0.52, 0.3) + 0.08 * bump(h, 0.98, 0.05)),
];

/** Smooth start and stop between two shapes. */
export const smoothstep = (t: number) => {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
};

/**
 * The outline at scroll progress `p` (0–1): the four profiles in turn, each hand-over eased. Pinned to
 * the first and last shape outside the range.
 */
export function morphProfile(p: number, profiles: readonly Profile[] = PROFILES): Profile {
  const span = profiles.length - 1;
  const t = Math.min(span, Math.max(0, p * span));
  const index = Math.min(span - 1, Math.floor(t));
  const mix = smoothstep(t - index);
  const from = profiles[index] as Profile;
  const to = profiles[index + 1] as Profile;
  return from.map(([r, y], i) => [r + ((to[i]?.[0] ?? r) - r) * mix, y] as const);
}

/** How far the blue glaze has been painted on (0–1): it starts once the vase has its shape. */
export const paintProgress = (p: number) => smoothstep((p - 0.45) / 0.45);

/** Kiln glow (0–1): rises while the vase is "fired" in the middle of the scroll, then cools. */
export const kilnGlow = (p: number) => Math.max(0, Math.sin(Math.PI * smoothstep((p - 0.3) / 0.6)));

/** Scroll progress through an element: 0 with its top at the viewport top, 1 once it has scrolled past. */
export function scrollProgress(top: number, height: number): number {
  return height > 0 ? Math.min(1, Math.max(0, -top / height)) : 0;
}
