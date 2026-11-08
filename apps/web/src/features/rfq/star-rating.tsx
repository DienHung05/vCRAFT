'use client';

import { RATING_MAX_STARS } from '@vcraft/domain';
import { cn } from '@vcraft/ui';
import { Star } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';

const STARS = Array.from({ length: RATING_MAX_STARS }, (_, index) => index + 1);

/**
 * Pick 1 to 5 stars (FR-ORD-11). It is a radio group of native radio inputs, so Tab enters it once and the
 * arrow keys move and select, exactly as for any radio group; each star announces as "N stars".
 */
export function StarRatingInput({
  name,
  label,
  value,
  onChange,
  disabled = false,
}: {
  /** Groups the radios; unique per rated household. */
  name: string;
  /** Accessible name of the group, such as "Stars for Household A". */
  label: string;
  /** 0 means nothing chosen yet. */
  value: number;
  onChange: (stars: number) => void;
  disabled?: boolean;
}) {
  const t = useTranslations('rating');
  return (
    <div role="radiogroup" aria-label={label} className="flex items-center gap-1">
      {STARS.map((star) => (
        <label
          key={star}
          className={cn(
            'relative inline-flex p-0.5',
            disabled ? 'cursor-default' : 'cursor-pointer',
          )}
        >
          <input
            type="radio"
            name={name}
            value={star}
            checked={value === star}
            disabled={disabled}
            onChange={() => onChange(star)}
            className="peer sr-only"
          />
          <Star
            aria-hidden
            className={cn(
              'size-7 rounded-sm peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-glaze',
              star <= value ? 'fill-clay text-clay' : 'text-ash',
            )}
          />
          <span className="sr-only">{t('star', { count: star })}</span>
        </label>
      ))}
    </div>
  );
}

/** Read-only stars with the mean next to them, for a household card or page; null average means no rating. */
export function RatingSummary({
  average,
  count,
  className,
}: {
  average: number | null;
  count: number;
  className?: string;
}) {
  const t = useTranslations('rating');
  const format = useFormatter();
  if (average === null || count === 0)
    return <span className={cn('text-small text-ash', className)}>{t('none')}</span>;
  const mean = format.number(average, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  return (
    <span
      className={cn('inline-flex items-center gap-1 text-small', className)}
      role="img"
      aria-label={t('summaryLabel', { average: mean, count })}
    >
      <Star aria-hidden className="size-4 fill-clay text-clay" />
      <span aria-hidden>{t('summary', { average: mean, count })}</span>
    </span>
  );
}
