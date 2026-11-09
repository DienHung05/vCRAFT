/**
 * The text to show for `locale`: the English one on `/en` when there is one (FR-CAT-08), otherwise the
 * Vietnamese one. Kept free of imports so the header bundle can use it.
 */
export function textFor(locale: string, vi: string, en?: string | null): string {
  return locale === 'en' && en?.trim() ? en : vi;
}

/** Like {@link textFor} for an optional Vietnamese value; empty on both sides gives null. */
export function optionalTextFor(
  locale: string,
  vi: string | null | undefined,
  en?: string | null,
): string | null {
  const text = textFor(locale, vi ?? '', en);
  return text.trim() ? text : null;
}
