'use client';

import { CRAFT_CATEGORIES, type CraftCategory } from '@vcraft/domain';
import { useTranslations } from 'next-intl';
import { inputClass } from './workshop-editor';

/**
 * Craft category from the fixed list (FR-ART-01) plus the household's own words as optional detail
 * ("men lam"). Legacy households arrive with a category inferred from their old free text.
 */
export function CraftFields({
  category,
  detail,
  onCategory,
  onDetail,
}: {
  category: CraftCategory | '';
  detail: string;
  onCategory: (category: CraftCategory | '') => void;
  onDetail: (detail: string) => void;
}) {
  const t = useTranslations('studio.profile');
  const labels = useTranslations('catalog.craftCategories');
  return (
    <>
      <label className="flex flex-col gap-1 text-small">
        {t('craftCategory')}
        <select
          value={category}
          onChange={(event) => onCategory(event.target.value as CraftCategory | '')}
          className={inputClass}
        >
          <option value="">{t('craftCategoryPlaceholder')}</option>
          {CRAFT_CATEGORIES.map((value) => (
            <option key={value} value={value}>
              {labels(value)}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-small">
        {t('craftDetail')}
        <input
          value={detail}
          onChange={(event) => onDetail(event.target.value)}
          className={inputClass}
        />
      </label>
    </>
  );
}
