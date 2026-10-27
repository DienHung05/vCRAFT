import { type ClassValue, clsx } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

/**
 * Gộp class Tailwind, biết các token tùy biến của vCraft (thang chữ, bo góc, bóng, font)
 * để không nhầm `text-h1` (cỡ chữ) với `text-ink` (màu) và xóa mất một trong hai.
 */
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      // Nhịp biên tập (`px-gutter`, `py-section`) và khung (`max-w-editorial`, `max-w-prose-vn`).
      spacing: ['gutter', 'section'],
      container: ['editorial', 'prose-vn'],
    },
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
