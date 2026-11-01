'use client';

import { useEffect } from 'react';
import { FONTS_FLAG } from '@/lib/web-fonts';

/**
 * Turns the web fonts on once the page has hydrated (see `lib/web-fonts.ts` for why they are not
 * requested at first layout) and remembers it, so the next full page load enables them from `<head>`.
 */
export function WebFonts() {
  useEffect(() => {
    document.documentElement.dataset.fonts = 'ready';
    try {
      localStorage.setItem(FONTS_FLAG, '1');
    } catch {
      // Storage can be blocked; the fonts still switch on after hydration every time.
    }
  }, []);
  return null;
}
