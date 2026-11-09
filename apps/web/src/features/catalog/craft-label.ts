import type { CraftCategory } from '@vcraft/domain';

/**
 * The craft text to show for a household. Vietnamese keeps the household's own free text (it is richer);
 * other locales show the translated category, falling back to the free text when there is no category.
 */
export function craftLabel(
  locale: string,
  household: { craft: string | null; craftCategory?: CraftCategory | null | undefined },
  categoryLabel: (category: CraftCategory) => string,
): string | null {
  if (locale === 'vi') return household.craft;
  return household.craftCategory ? categoryLabel(household.craftCategory) : household.craft;
}
