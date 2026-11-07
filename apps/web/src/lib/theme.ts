/*
 * Light ("Giấy dó") / dark ("Lò đêm") override. `packages/ui/src/tokens/theme.css` follows the OS through
 * `prefers-color-scheme` unless `<html data-theme>` forces one palette. The viewer's choice is kept in
 * localStorage and applied by `THEME_SCRIPT` in `<head>` before the first paint, so a reload never flashes
 * the other theme. With no stored choice the attribute stays unset and the site keeps following the OS.
 */

export type Theme = 'light' | 'dark';

/** localStorage key holding the viewer's explicit choice; read by `THEME_SCRIPT`. */
export const THEME_KEY = 'vcraft-theme';

/** Runs in `<head>` before the first paint. Storage can throw (private mode, blocked site data). */
export const THEME_SCRIPT = `try{var t=localStorage.getItem('${THEME_KEY}');if(t==='light'||t==='dark')document.documentElement.dataset.theme=t}catch(e){}`;

export function parseTheme(value: string | null | undefined): Theme | null {
  return value === 'light' || value === 'dark' ? value : null;
}

/** The theme on screen: the forced attribute if any, else the OS preference. */
export function effectiveTheme(forced: Theme | null, osPrefersDark: boolean): Theme {
  return forced ?? (osPrefersDark ? 'dark' : 'light');
}

export function oppositeTheme(theme: Theme): Theme {
  return theme === 'dark' ? 'light' : 'dark';
}

export function readStoredTheme(): Theme | null {
  try {
    return parseTheme(localStorage.getItem(THEME_KEY));
  } catch {
    return null;
  }
}

export function storeTheme(theme: Theme): void {
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    // Storage blocked: the switch still applies to this page view.
  }
}

export interface ThemeWave {
  /** Wave centre in viewport px. */
  x: number;
  y: number;
  /** Radius that reaches the farthest viewport corner from the centre. */
  r: number;
}

/**
 * Where the theme wave starts (GH#214): at the pointer for a click, or at the button's centre for keyboard
 * activation (a keyboard "click" reports `detail` 0 and no useful coordinates). The radius covers the
 * farthest corner of the viewport, so the wave always ends with the whole page switched.
 */
export function themeWaveOrigin(
  click: { detail: number; clientX: number; clientY: number },
  button: { left: number; top: number; width: number; height: number },
  viewport: { width: number; height: number },
): ThemeWave {
  const fromPointer = click.detail > 0;
  const x = fromPointer ? click.clientX : button.left + button.width / 2;
  const y = fromPointer ? click.clientY : button.top + button.height / 2;
  const r = Math.hypot(Math.max(x, viewport.width - x), Math.max(y, viewport.height - y));
  return { x: Math.round(x), y: Math.round(y), r: Math.ceil(r) };
}
