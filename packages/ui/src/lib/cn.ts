import { type ClassValue, clsx } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

/**
 * Gộp class Tailwind, biết các token tùy biến của vCraft (thang chữ, bo góc, bóng, font)
 * để không nhầm `text-h1` (cỡ chữ) với `text-ink` (màu) và xóa mất một trong hai.
 */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [{ text: ['display', 'h1', 'h2', 'h3', 'body', 'small'] }],
      rounded: [{ rounded: ['input', 'card', 'chip'] }],
      shadow: [{ shadow: ['warm'] }],
      'font-family': [{ font: ['display', 'sans', 'mono'] }],
    },
  },
});

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
