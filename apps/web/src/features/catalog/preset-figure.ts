import type { ProductFigureKind } from '@vcraft/ui';

/** Lower-case, accent-free text so that "Lư hương" and "lu huong" match the same rule. */
function plain(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replaceAll('đ', 'd')
    .replaceAll('Đ', 'd')
    .toLowerCase();
}

/** First matching rule wins, so the specific words (incense burner, tea set) come before the broad ones (bowl). */
const NAME_RULES: readonly [RegExp, ProductFigureKind][] = [
  [/\b(lu huong|lo huong)\b/, 'incense'],
  [/\b(bo am|am chen|am tra|khay tra)\b/, 'teaset'],
  [/\b(coc|tach|ly|chen)\b/, 'cup'],
  [/\bdia\b/, 'plate'],
  [/\b(bat|to|au)\b/, 'bowl'],
  [/\bbinh ngam ruou\b/, 'jar'],
  [/\b(hu|chau|ong dung but)\b/, 'jar'],
  [/\b(binh|luc binh|lo hoa|lo)\b/, 'vase'],
];

const CATEGORY_FALLBACK: Record<string, ProductFigureKind> = {
  TABLEWARE: 'bowl',
  TEA: 'cup',
  VASE: 'vase',
  DECOR: 'jar',
  WORSHIP: 'incense',
};

/**
 * Which placeholder illustration fits a product that has no photo, chosen from the words in its name and
 * then from its category. The result is only a drawing of a kind of object, never a claim about the product.
 */
export function presetKindOf(category: string | undefined, name: string): ProductFigureKind {
  const text = plain(name);
  for (const [rule, kind] of NAME_RULES) {
    if (rule.test(text)) return kind;
  }
  return (category && CATEGORY_FALLBACK[category]) || 'generic';
}
