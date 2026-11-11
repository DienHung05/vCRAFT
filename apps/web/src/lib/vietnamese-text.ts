/**
 * The `lang` attribute for text a page shows in Vietnamese although the page is English (GH#482), so screen
 * readers pronounce it right. Kept free of imports, like `localized-text`.
 *
 * A household writes journal notes, maker credits, visiting info and the like in Vietnamese only: on `/en` such
 * text carries `lang="vi"`; on `/vi` the page language already says it, so there is no attribute.
 */
export function vietnameseOnlyLang(locale: string): 'vi' | undefined {
  return locale === 'en' ? 'vi' : undefined;
}

/**
 * `lang` for a value read with `textFor(locale, vi, en)`: `vi` when the page is English and the English text is
 * missing, so the Vietnamese fallback is announced as Vietnamese; otherwise no attribute.
 */
export function fallbackLang(locale: string, en?: string | null): 'vi' | undefined {
  return locale === 'en' && !en?.trim() ? 'vi' : undefined;
}
