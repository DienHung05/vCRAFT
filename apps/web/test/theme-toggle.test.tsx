import { act, cleanup, fireEvent, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemeToggle } from '@/components/shell/theme-toggle';
import { effectiveTheme, parseTheme, THEME_KEY, THEME_SCRIPT } from '@/lib/theme';
import { renderEn, renderVi } from './render';

let osDark = false;

beforeEach(() => {
  osDark = false;
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches: query.includes('dark') ? osDark : false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
});

afterEach(() => {
  // Unmount first: the observer would otherwise read the unstubbed matchMedia when data-theme is cleared.
  cleanup();
  delete document.documentElement.dataset.theme;
  localStorage.clear();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('theme helpers', () => {
  it('accepts only the two palettes', () => {
    expect(parseTheme('dark')).toBe('dark');
    expect(parseTheme('light')).toBe('light');
    expect(parseTheme('sepia')).toBeNull();
    expect(parseTheme(null)).toBeNull();
  });

  it('a forced theme wins over the OS preference', () => {
    expect(effectiveTheme(null, true)).toBe('dark');
    expect(effectiveTheme(null, false)).toBe('light');
    expect(effectiveTheme('light', true)).toBe('light');
  });

  it('the head script applies only a stored valid choice', () => {
    new Function(THEME_SCRIPT)();
    expect(document.documentElement.dataset.theme).toBeUndefined();
    localStorage.setItem(THEME_KEY, 'bogus');
    new Function(THEME_SCRIPT)();
    expect(document.documentElement.dataset.theme).toBeUndefined();
    localStorage.setItem(THEME_KEY, 'dark');
    new Function(THEME_SCRIPT)();
    expect(document.documentElement.dataset.theme).toBe('dark');
  });

  it('the head script survives blocked storage', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(() => new Function(THEME_SCRIPT)()).not.toThrow();
    expect(document.documentElement.dataset.theme).toBeUndefined();
  });
});

describe('<ThemeToggle>', () => {
  it('flips away from the OS theme on the first click and remembers the choice', () => {
    osDark = true;
    renderVi(<ThemeToggle />);
    fireEvent.click(screen.getByRole('button', { name: 'Chuyển sang giao diện sáng' }));
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(localStorage.getItem(THEME_KEY)).toBe('light');
  });

  it('names the target theme and toggles back', async () => {
    renderEn(<ThemeToggle />);
    fireEvent.click(screen.getByRole('button', { name: 'Switch to dark theme' }));
    expect(document.documentElement.dataset.theme).toBe('dark');
    // The MutationObserver re-renders the label asynchronously.
    await act(async () => {});
    fireEvent.click(screen.getByRole('button', { name: 'Switch to light theme' }));
    expect(document.documentElement.dataset.theme).toBe('light');
  });

  it('still switches when storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    renderEn(<ThemeToggle />);
    fireEvent.click(screen.getByRole('button', { name: 'Switch to dark theme' }));
    expect(document.documentElement.dataset.theme).toBe('dark');
  });
});
