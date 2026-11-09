/**
 * Fixed craft categories a household picks from (FR-ART-01). Labels live in `@vcraft/i18n`
 * (`studio.profile.craftCategories`); the household's own words stay in the free-text `craft` detail.
 */
export const CRAFT_CATEGORIES = ['GOM_SU', 'MEN', 'VE_GOM', 'NUNG', 'KHAC'] as const;
export type CraftCategory = (typeof CRAFT_CATEGORIES)[number];

const fold = (text: string) =>
  text.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[đĐ]/g, 'd').toLowerCase();

/** Keyword rules for legacy free text, tried in order; the first match wins. */
const LEGACY_RULES: readonly (readonly [CraftCategory, RegExp])[] = [
  ['VE_GOM', /\bve\b|\bve tay\b|hoa tiet/],
  ['NUNG', /\bnung\b|\blo nung\b/],
  ['MEN', /\bmen\b/],
  ['GOM_SU', /\bgom\b|\bsu\b|\bbinh\b|\bbat\b|\bdia\b|\bam\b|\bchen\b|\bcoc\b|\btuong\b|\bgach\b/],
];

/**
 * Best-effort category for a household's legacy free-text craft ("men lam", "vẽ tay hoa sen"). A text
 * that matches no rule is `KHAC`; an empty one has no category at all. The text itself is never changed.
 */
export function inferCraftCategory(legacyText: string | null | undefined): CraftCategory | null {
  const text = fold(legacyText ?? '').trim();
  if (text === '') return null;
  return LEGACY_RULES.find(([, pattern]) => pattern.test(text))?.[0] ?? 'KHAC';
}

/** The category to show: the stored one, or the inferred one for a household that only has legacy text. */
export function effectiveCraftCategory(
  stored: CraftCategory | null | undefined,
  legacyText: string | null | undefined,
): CraftCategory | null {
  return stored ?? inferCraftCategory(legacyText);
}

/**
 * The year of a certification: derived from its issue date (`YYYY-MM-DD`) when there is one, otherwise the
 * year the household typed (legacy entries have only a year).
 */
export function certificationYear(cert: {
  year?: number | undefined;
  issuedOn?: string | null | undefined;
}): number | null {
  if (cert.issuedOn) {
    const year = Number(cert.issuedOn.slice(0, 4));
    if (Number.isInteger(year)) return year;
  }
  return cert.year ?? null;
}
