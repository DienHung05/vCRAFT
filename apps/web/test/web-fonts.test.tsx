import { render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { WebFonts } from '@/components/web-fonts';
import { FONTS_FLAG, FONTS_FLAG_SCRIPT, webFontVars } from '@/lib/web-fonts';

describe('webFontVars', () => {
  it('splits next/font family lists into a full and a fallback-only custom property', () => {
    expect(
      webFontVars({
        'font-fraunces': "'__Fraunces_1a', '__Fraunces_Fallback_1a'",
        'font-x': 'serif',
      }),
    ).toEqual({
      '--font-fraunces-web': "'__Fraunces_1a', '__Fraunces_Fallback_1a'",
      '--font-fraunces-fallback': "'__Fraunces_Fallback_1a'",
      '--font-x-web': 'serif',
      '--font-x-fallback': 'serif',
    });
  });
});

describe('<WebFonts>', () => {
  afterEach(() => {
    delete document.documentElement.dataset.fonts;
    localStorage.clear();
  });

  it('enables the web fonts after mount and remembers it for the next page load', () => {
    expect(document.documentElement.dataset.fonts).toBeUndefined();
    render(<WebFonts />);
    expect(document.documentElement.dataset.fonts).toBe('ready');
    expect(localStorage.getItem(FONTS_FLAG)).toBe('1');
  });

  it('the head script enables them before paint only for a returning visitor', () => {
    new Function(FONTS_FLAG_SCRIPT)();
    expect(document.documentElement.dataset.fonts).toBeUndefined();
    localStorage.setItem(FONTS_FLAG, '1');
    new Function(FONTS_FLAG_SCRIPT)();
    expect(document.documentElement.dataset.fonts).toBe('ready');
  });
});
