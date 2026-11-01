import { useFormatter, useLocale, useTranslations } from 'next-intl';
import { useUsdRate } from '@/components/usd-rate-provider';
import { showsUsdReference, usdFractionDigits, vndToUsd } from './currency';

/**
 * Returns a formatter for VND amounts that are interpolated into a translated sentence (where
 * the `<UsdReference>` element cannot be used): `1.250.000 ₫` on `vi`, and
 * `₫1,250,000 (≈ US$50)` on `en` (FR-CAT-08). Zero stays plain because it means "no price yet".
 */
export function useMoney(): (vnd: number) => string {
  const format = useFormatter();
  const locale = useLocale();
  const t = useTranslations('common');
  const { rate } = useUsdRate();
  return (vnd) => {
    const base = format.number(vnd, 'vnd');
    if (!showsUsdReference(locale) || !(vnd > 0)) return base;
    const usd = vndToUsd(vnd, rate);
    const digits = usdFractionDigits(usd);
    const amount = format.number(usd, {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    });
    return `${base} (${t('usdApprox', { amount })})`;
  };
}
