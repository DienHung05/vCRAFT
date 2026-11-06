/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * PLAN E13 / #96: every text colour stays WCAG AA (4.5:1) on both backgrounds, in the light "Giấy dó" palette
 * and the dark "Lò đêm" palette, read straight from the tokens file so a colour change cannot slip past.
 */
const css = readFileSync(new URL('../src/tokens/theme.css', import.meta.url), 'utf8');

function palette(block: string): Record<string, string> {
  return Object.fromEntries(
    [...block.matchAll(/--color-(\w+):\s*(#[0-9a-f]{6})\s*;/gi)].map((m) => [m[1], m[2]]),
  ) as Record<string, string>;
}

const light = palette(css.slice(0, css.indexOf('@media (prefers-color-scheme: dark)')));
const dark = palette(css.slice(css.indexOf(':root[data-theme="dark"]')));

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const v = Number.parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

const TEXT = ['ink', 'ash', 'clay', 'glaze', 'seal'];
const BACKGROUNDS = ['paper', 'surface'];

describe.each([
  ['light', light],
  ['dark', dark],
])('%s theme', (_name, colours) => {
  it.each(TEXT.flatMap((text) => BACKGROUNDS.map((bg) => [text, bg])))(
    '%s on %s is at least 4.5:1',
    (text, bg) => {
      expect(colours[text], text).toBeDefined();
      expect(contrast(colours[text] as string, colours[bg] as string)).toBeGreaterThanOrEqual(4.5);
    },
  );
});

it('keeps the two dark blocks identical', () => {
  const media = palette(
    css.slice(
      css.indexOf('@media (prefers-color-scheme: dark)'),
      css.indexOf(':root[data-theme="dark"]'),
    ),
  );
  expect(media).toEqual(dark);
});
