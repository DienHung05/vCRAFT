import { useFormatter, useLocale, useTranslations } from 'next-intl';
import { showsUsdReference, USD_VND_RATE, usdFractionDigits, vndToUsd } from '@/lib/currency';

/**
 * "≈ US$12" next to a VND price (FR-CAT-08), on the English locale only. Renders nothing for a
 * zero price (price on request) or on `vi`. Works in server and client components.
 */
export function UsdReference({ vnd, className }: { vnd: number; className?: string }) {
  const locale = useLocale();
  const format = useFormatter();
  const t = useTranslations('common');
  if (!showsUsdReference(locale) || !(vnd > 0)) return null;
  const usd = vndToUsd(vnd);
  const digits = usdFractionDigits(usd);
  return (
    <span
      data-testid="usd-reference"
      title={t('usdRateNote', { rate: format.number(USD_VND_RATE) })}
      className={className ?? 'text-small text-ash'}
    >
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
 * One line explaining the reference rate. Place it once near a group of prices (product page,
 * quotation) so the approximation is disclosed in text, not only in a tooltip.
 */
export function UsdRateNote({ className }: { className?: string }) {
  const locale = useLocale();
  const format = useFormatter();
  const t = useTranslations('common');
  if (!showsUsdReference(locale)) return null;
  return (
    <p className={className ?? 'text-small text-ash'}>
      {t('usdRateNote', { rate: format.number(USD_VND_RATE) })}
    </p>
  );
}
