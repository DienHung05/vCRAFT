'use client';

import type { AdminNewsDto, SaveNewsRequest } from '@vcraft/contracts';
import { MATERIALS, type Material } from '@vcraft/domain';
import { useTranslations } from 'next-intl';
import { inputClass } from '@/features/studio/workshop-editor';

/** Editable form of the structured part of a news item (PLAN E11). Prices are kept as typed text. */
export interface StructuredValues {
  effectiveOn: string;
  prices: Record<Material, string>;
  units: Record<Material, string>;
  outage: { date: string; from: string; to: string; area: string };
  /** Cuts beyond the first one, kept as they were: the form edits one cut at a time. */
  otherOutages: NonNullable<AdminNewsDto['powerSchedule']>['outages'];
}

const DEFAULT_UNITS: Record<Material, string> = { CLAY: 'tấn', GLAZE: 'kg', GAS: 'bình 12 kg' };

export const EMPTY_STRUCTURED: StructuredValues = {
  effectiveOn: '',
  prices: { CLAY: '', GLAZE: '', GAS: '' },
  units: DEFAULT_UNITS,
  outage: { date: '', from: '', to: '', area: '' },
  otherOutages: [],
};

export function structuredValuesOf(news: AdminNewsDto): StructuredValues {
  const prices = { ...EMPTY_STRUCTURED.prices };
  const units = { ...DEFAULT_UNITS };
  for (const p of news.materialPrices?.prices ?? []) {
    prices[p.material] = String(p.priceVnd);
    units[p.material] = p.unit;
  }
  const [first, ...rest] = news.powerSchedule?.outages ?? [];
  return {
    effectiveOn: news.materialPrices?.effectiveOn ?? '',
    prices,
    units,
    outage: first ?? EMPTY_STRUCTURED.outage,
    otherOutages: rest,
  };
}

/** The request fields for the category: prices or outages, or neither for other categories. */
export function structuredRequest(
  category: SaveNewsRequest['category'],
  values: StructuredValues,
): Pick<SaveNewsRequest, 'materialPrices' | 'powerSchedule'> {
  if (category === 'MATERIAL_PRICES') {
    const prices = MATERIALS.flatMap((material) => {
      const price = Number(values.prices[material]);
      return values.prices[material].trim() && Number.isSafeInteger(price) && price > 0
        ? [{ material, unit: values.units[material], priceVnd: price }]
        : [];
    });
    return {
      materialPrices:
        prices.length > 0 && values.effectiveOn
          ? { effectiveOn: values.effectiveOn, prices }
          : null,
    };
  }
  if (category === 'POWER_SCHEDULE') {
    const { date, from, to, area } = values.outage;
    const first = date && from && to && area.trim() ? [{ date, from, to, area: area.trim() }] : [];
    const outages = [...first, ...values.otherOutages];
    return { powerSchedule: outages.length > 0 ? { outages } : null };
  }
  return {};
}

/** Extra fields under the category select for `MATERIAL_PRICES` and `POWER_SCHEDULE` items. */
export function StructuredNewsFields({
  category,
  values,
  onChange,
}: {
  category: SaveNewsRequest['category'];
  values: StructuredValues;
  onChange: (values: StructuredValues) => void;
}) {
  const t = useTranslations('admin.news.structured');
  const materials = useTranslations('news.materialPrices.materials');
  if (category === 'MATERIAL_PRICES')
    return (
      <fieldset className="flex flex-col gap-3 rounded-card border border-ink/10 p-4">
        <legend className="px-1 text-small font-medium">{t('pricesLegend')}</legend>
        <label className="flex flex-col gap-1 sm:max-w-56">
          {t('effectiveOn')}
          <input
            type="date"
            value={values.effectiveOn}
            onChange={(e) => onChange({ ...values, effectiveOn: e.target.value })}
            className={inputClass}
          />
        </label>
        <div className="grid gap-3 sm:grid-cols-3">
          {MATERIALS.map((material) => (
            <label key={material} className="flex flex-col gap-1">
              {t('priceOf', { material: materials(material), unit: values.units[material] })}
              <input
                inputMode="numeric"
                value={values.prices[material]}
                onChange={(e) =>
                  onChange({ ...values, prices: { ...values.prices, [material]: e.target.value } })
                }
                className={inputClass}
              />
            </label>
          ))}
        </div>
        <p className="text-small text-ash">{t('pricesHint')}</p>
      </fieldset>
    );
  if (category === 'POWER_SCHEDULE')
    return (
      <fieldset className="flex flex-col gap-3 rounded-card border border-ink/10 p-4">
        <legend className="px-1 text-small font-medium">{t('outageLegend')}</legend>
        <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
          <label className="flex flex-col gap-1">
            {t('date')}
            <input
              type="date"
              value={values.outage.date}
              onChange={(e) =>
                onChange({ ...values, outage: { ...values.outage, date: e.target.value } })
              }
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1">
            {t('from')}
            <input
              type="time"
              value={values.outage.from}
              onChange={(e) =>
                onChange({ ...values, outage: { ...values.outage, from: e.target.value } })
              }
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1">
            {t('to')}
            <input
              type="time"
              value={values.outage.to}
              onChange={(e) =>
                onChange({ ...values, outage: { ...values.outage, to: e.target.value } })
              }
              className={inputClass}
            />
          </label>
        </div>
        <label className="flex flex-col gap-1">
          {t('area')}
          <input
            value={values.outage.area}
            maxLength={160}
            onChange={(e) =>
              onChange({ ...values, outage: { ...values.outage, area: e.target.value } })
            }
            className={inputClass}
          />
        </label>
        <p className="text-small text-ash">
          {t('outageHint', { more: values.otherOutages.length })}
        </p>
      </fieldset>
    );
  return null;
}
