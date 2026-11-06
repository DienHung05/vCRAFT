'use client';

import { vndInWords } from '@vcraft/utils';
import { useLocale } from 'next-intl';

/**
 * The amount typed in a VND price field, read out in Vietnamese words under the input (PLAN S6), so a
 * missing or extra zero is easy to spot. Shown on the Vietnamese site only; empty or invalid input shows nothing.
 */
export function AmountInWords({ value, id }: { value: string; id?: string }) {
  const locale = useLocale();
  const trimmed = value.trim();
  const words = locale === 'vi' && /^\d+$/.test(trimmed) ? vndInWords(Number(trimmed)) : null;
  return (
    <span id={id} aria-live="polite" className="text-small text-ash italic">
      {words}
    </span>
  );
}
