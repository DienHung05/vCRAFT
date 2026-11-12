import { render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { WebFonts } from '@/components/web-fonts';
import { displayFontReady, FONTS_FLAG, FONTS_FLAG_SCRIPT, webFontVars } from '@/lib/web-fonts';

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

describe('displayFontReady', () => {
  const stubFonts = (load: (font: string, text?: string) => Promise<unknown[]>) =>
    Object.defineProperty(document, 'fonts', { value: { load }, configurable: true });

  afterEach(() => {
    vi.useRealTimers();
    document.documentElement.style.removeProperty('--font-fraunces-web');
    Reflect.deleteProperty(document, 'fonts');
  });

  it('loads the web font list from <html style> for the given text', async () => {
    document.documentElement.style.setProperty('--font-fraunces-web', 'Fraunces, serif');
    const load = vi.fn(async () => [{}]);
    stubFonts(load);
    await expect(displayFontReady('Mỗi món', 1000)).resolves.toBe(true);
    expect(load).toHaveBeenCalledWith('400 1em Fraunces, serif', 'Mỗi món');
  });

  it('gives up when the font does not arrive in time', async () => {
    vi.useFakeTimers();
    document.documentElement.style.setProperty('--font-fraunces-web', 'Fraunces, serif');
    stubFonts(() => new Promise(() => {}));
    const result = displayFontReady('x', 500);
    await vi.advanceTimersByTimeAsync(500);
    await expect(result).resolves.toBe(false);
  });

  it('is false when loading fails, nothing matched, or the font is not configured', async () => {
    stubFonts(async () => [{}]);
    await expect(displayFontReady('x', 100)).resolves.toBe(false);
    document.documentElement.style.setProperty('--font-fraunces-web', 'Fraunces, serif');
    stubFonts(async () => {
      throw new Error('network');
    });
    await expect(displayFontReady('x', 100)).resolves.toBe(false);
    stubFonts(async () => []);
    await expect(displayFontReady('x', 100)).resolves.toBe(false);
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
