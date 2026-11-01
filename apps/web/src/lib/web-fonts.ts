import type { CSSProperties } from 'react';

/*
 * Web fonts load after the page has hydrated, not at first layout.
 *
 * Lighthouse (simulated throttling) charges an image LCP for every font and script that finished
 * before it painted. The three families cost ~280 KB (Fraunces alone ~135 KB across its vietnamese,
 * latin-ext and latin files), which on a throttled link is ~1.7 s of the hero's LCP, and on a real
 * phone they compete with the hero for the same bandwidth. So until `<html data-fonts="ready">`,
 * `--font-fraunces/-be-vietnam/-jetbrains-mono` hold only next/font's metric-matched fallback face
 * (`size-adjust`, no download), and `<WebFonts>` flips the attribute once React has hydrated. The
 * swap is `font-display: swap` over a face with the same metrics, so text barely moves (CLS ~0).
 * A returning visitor skips the wait: the flag below is set on the first swap and read by an inline
 * script in `<head>`, before the first paint. The rules live in `styles/globals.css`.
 */

/** localStorage key set once the fonts have been enabled; read by `FONTS_FLAG_SCRIPT`. */
export const FONTS_FLAG = 'vcraft-fonts';

/** Runs in `<head>` before the first paint: returning visitors get the web fonts immediately. */
export const FONTS_FLAG_SCRIPT = `try{if(localStorage.getItem('${FONTS_FLAG}')==='1')document.documentElement.dataset.fonts='ready'}catch(e){}`;

/**
 * Custom properties for `<html style>`: `--<name>-web` is the font's full family list and
 * `--<name>-fallback` only its metric-matched fallback (the last entry of next/font's list).
 * `families` maps a CSS variable stem (`font-fraunces`) to `font.style.fontFamily`.
 */
export function webFontVars(families: Record<string, string>): CSSProperties {
  const vars: Record<string, string> = {};
  for (const [stem, family] of Object.entries(families)) {
    vars[`--${stem}-web`] = family;
    vars[`--${stem}-fallback`] = family.split(',').at(-1)?.trim() ?? family;
  }
  return vars as CSSProperties;
}
