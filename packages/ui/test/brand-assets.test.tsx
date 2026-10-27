import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import logoSvg from '../assets/brand/logo.svg?raw';
import sealSvg from '../assets/brand/seal.svg?raw';
import sealInkSvg from '../assets/brand/seal-ink.svg?raw';
import sealInverseSvg from '../assets/brand/seal-inverse.svg?raw';
import { Logo, SealMark, TraceSealFrame } from '../src';
import { SEAL_BAND_PATH, SEAL_PATH, SEAL_VASE_PATH } from '../src/ornaments/seal-geometry';

const assets = {
  'seal.svg': sealSvg,
  'seal-ink.svg': sealInkSvg,
  'seal-inverse.svg': sealInverseSvg,
  'logo.svg': logoSvg,
} as const;

describe('file SVG tĩnh khớp hình học component', () => {
  for (const [name, svg] of Object.entries(assets)) {
    it(name, () => {
      expect(svg).toContain(`d="${SEAL_PATH}"`);
      expect(svg).toContain(`d="${SEAL_VASE_PATH}"`);
      expect(svg).toContain(`d="${SEAL_BAND_PATH}"`);
    });
  }

  it('hai biến thể màu dùng đúng token', () => {
    expect(assets['seal.svg']).toContain('var(--color-seal');
    expect(assets['seal-ink.svg']).toContain('var(--color-ink');
    expect(assets['seal-inverse.svg']).toContain('var(--color-paper');
  });
});

describe('SealMark', () => {
  it('có title ⇒ role="img" + aria-label', () => {
    const html = renderToStaticMarkup(<SealMark title="vCraft" />);
    expect(html).toContain('role="img"');
    expect(html).toContain('aria-label="vCraft"');
    expect(html).not.toContain('aria-hidden');
  });

  it('không có title ⇒ aria-hidden', () => {
    const html = renderToStaticMarkup(<SealMark />);
    expect(html).toContain('aria-hidden="true"');
    expect(html).not.toContain('role="img"');
  });

  it('dùng token màu, không hard-code hex', () => {
    const html = renderToStaticMarkup(<SealMark />);
    expect(html).toContain('var(--color-seal)');
    expect(html).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(renderToStaticMarkup(<SealMark variant="ink" />)).toContain('var(--color-ink)');
    expect(renderToStaticMarkup(<SealMark variant="inverse" />)).toContain('var(--color-paper)');
  });

  it('id mask/filter không đụng nhau giữa các thể hiện', () => {
    const html = renderToStaticMarkup(
      <div>
        <SealMark />
        <SealMark />
      </div>,
    );
    const ids = [...html.matchAll(/ id="([^"]+)"/g)].map((m) => m[1]);
    expect(ids.length).toBe(4);
    expect(new Set(ids).size).toBe(4);
    for (const id of ids) expect(id).toMatch(/^[\w-]+$/);
  });
});

describe('Logo & TraceSealFrame', () => {
  it('Logo có chữ vCraft', () => {
    expect(renderToStaticMarkup(<Logo />)).toContain('vCraft');
  });

  it('TraceSealFrame hiện mã và bọc children', () => {
    const html = renderToStaticMarkup(
      <TraceSealFrame code="A1B2C3D4">
        <i>qr</i>
      </TraceSealFrame>,
    );
    expect(html).toContain('A1B2C3D4');
    expect(html).toContain('<i>qr</i>');
  });
});
