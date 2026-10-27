'use client';

import { useReducedMotion as useMotionReducedMotion } from 'motion/react';

/**
 * `true` khi người dùng bật `prefers-reduced-motion: reduce` (BRAND §6.4).
 * Motion trả `null` trước khi hydrate; ở đây coi là `false` để kiểu trả về luôn là boolean.
 */
export function useReducedMotion(): boolean {
  return useMotionReducedMotion() ?? false;
}
