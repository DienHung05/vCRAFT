'use client';

import { useFormatter, useLocale, useTranslations } from 'next-intl';
import { showsUsdReference, usdFractionDigits, vndToUsd } from '@/lib/currency';
import { useUsdRate } from './usd-rate-provider';

/**
 * The sentence that discloses the reference rate and, when known, the day it was published.
 * Shared by the tooltip on each USD figure and by `<UsdRateNote>`.
 */
function useUsdRateNote(): string {
  const format = useFormatter();
  const t = useTranslations('common');
  const { rate, asOf } = useUsdRate();
  const formattedRate = format.number(rate, { maximumFractionDigits: 0 });
  if (!asOf) return t('usdRateNoteFallback', { rate: formattedRate });
  // The date has no time of day: format it in UTC so it never shifts to the neighbouring day.
  const date = format.dateTime(new Date(`${asOf}T00:00:00Z`), {
    dateStyle: 'medium',
    timeZone: 'UTC',
  });
  return t('usdRateNote', { rate: formattedRate, date });
}

/**
 * "≈ US$12" next to a VND price (FR-CAT-08), on the English locale only. Renders nothing for a
 * zero price (price on request) or on `vi`. Works in server and client components.
 */
export function UsdReference({ vnd, className }: { vnd: number; className?: string }) {
  const locale = useLocale();
  const format = useFormatter();
  const t = useTranslations('common');
  const { rate } = useUsdRate();
  const note = useUsdRateNote();
  if (!showsUsdReference(locale) || !(vnd > 0)) return null;
  const usd = vndToUsd(vnd, rate);
  const digits = usdFractionDigits(usd);
  return (
    <span data-testid="usd-reference" title={note} className={className ?? 'text-small text-ash'}>
      {t('usdApprox', {
        amount: format.number(usd, {
          minimumFractionDigits: digits,
          maximumFractionDigits: digits,
        }),
      })}
    </span>
  );
}

/**
 * One line explaining the reference rate and its date. Place it once near a group of prices
 * (product page, quotation) so the approximation is disclosed in text, not only in a tooltip.
 */
export function UsdRateNote({ className }: { className?: string }) {
  const locale = useLocale();
  const note = useUsdRateNote();
  if (!showsUsdReference(locale)) return null;
  return <p className={className ?? 'text-small text-ash'}>{note}</p>;
}
