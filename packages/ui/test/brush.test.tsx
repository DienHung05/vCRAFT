import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { BrushCurl, BrushLotus, BrushVine, BrushWaveBand, Crackle } from '../src';

const ORNAMENTS = {
  vine: <BrushVine />,
  lotus: <BrushLotus />,
  curl: <BrushCurl />,
  'compact curl': <BrushCurl compact />,
  'wave band': <BrushWaveBand />,
};

describe('brush ornaments', () => {
  for (const [name, ornament] of Object.entries(ORNAMENTS)) {
    it(`${name} is decorative and drawn by a mask of pathLength=1 centrelines`, () => {
      const markup = renderToStaticMarkup(ornament);
      expect(markup).toContain('aria-hidden="true"');
      expect(markup).toContain('pointer-events-none');
      const mask = markup.match(/<mask[^>]*>(.*?)<\/mask>/)?.[1] ?? '';
      const draws = mask.match(/<path[^>]*brush-draw[^>]*>/g) ?? [];
      expect(draws.length).toBeGreaterThan(0);
      for (const path of draws) expect(path).toContain('pathLength="1"');
    });
  }

  it('staggers the draw-on in 40ms steps capped at 12 (stagger.list)', () => {
    const steps = [...renderToStaticMarkup(<BrushVine />).matchAll(/--brush-i:(\d+)/g)].map((m) =>
      Number(m[1]),
    );
    expect(Math.max(...steps)).toBeLessThanOrEqual(11);
    expect(new Set(steps).size).toBeGreaterThan(1);
  });

  it('gives each instance its own mask and filter ids', () => {
    const markup = renderToStaticMarkup(
      <>
        <BrushVine />
        <BrushVine />
      </>,
    );
    const ids = [...markup.matchAll(/<(?:mask|filter) id="([^"]+)"/g)].map((m) => m[1]);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('Crackle', () => {
  it('keeps its defaults and accepts a pattern scale and stroke width', () => {
    expect(renderToStaticMarkup(<Crackle />)).not.toContain('patternTransform');
    const scaled = renderToStaticMarkup(<Crackle scale={0.62} strokeWidth={2.3} />);
    expect(scaled).toContain('patternTransform="scale(0.62)"');
    expect(scaled).toContain('stroke-width="2.3"');
  });
});
