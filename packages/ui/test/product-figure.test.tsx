import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PRODUCT_FIGURE_KINDS, ProductFigure } from '../src';

describe('ProductFigure', () => {
  const markup = Object.fromEntries(
    PRODUCT_FIGURE_KINDS.map((kind) => [kind, renderToStaticMarkup(<ProductFigure kind={kind} />)]),
  );

  it('draws every kind as a decorative svg with a wavy band', () => {
    for (const kind of PRODUCT_FIGURE_KINDS) {
      expect(markup[kind], kind).toContain('<svg');
      expect(markup[kind], kind).toContain('aria-hidden="true"');
      expect(markup[kind], kind).toContain('<path');
    }
  });

  it('draws a different silhouette for each kind, so a bowl is never a vase', () => {
    expect(new Set(Object.values(markup)).size).toBe(PRODUCT_FIGURE_KINDS.length);
  });

  it('only has valid path data (no NaN, no empty path)', () => {
    for (const kind of PRODUCT_FIGURE_KINDS) {
      for (const [, d] of markup[kind]?.matchAll(/ d="([^"]*)"/g) ?? []) {
        expect(d, kind).not.toBe('');
        expect(d, kind).not.toContain('NaN');
      }
    }
  });
});
