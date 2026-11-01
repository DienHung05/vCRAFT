import { cn } from '@vcraft/ui';
import { useTranslations } from 'next-intl';
import type { ComponentPropsWithRef } from 'react';
import { Link } from '@/i18n/navigation';

export type ConsentPurpose = 'account' | 'household' | 'quote' | 'artisan';

export interface ConsentCheckboxProps
  extends Omit<ComponentPropsWithRef<'input'>, 'type' | 'children'> {
  /** What the consent covers; picks the sentence that follows the policy link. */
  purpose: ConsentPurpose;
  /** Error text to show under the box (already translated); also sets `aria-invalid`. */
  error?: string | undefined;
}

/**
 * Required consent box that links to the privacy policy (NFR-SEC-07). The policy opens in a new tab
 * so what the user typed is not lost. Works with react-hook-form (`{...register('consent')}`) and
 * with plain controlled state (`checked` + `onChange`).
 */
export function ConsentCheckbox({ purpose, error, id, className, ...input }: ConsentCheckboxProps) {
  const t = useTranslations('privacy');
  const errorId = id ? `${id}-error` : undefined;
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <label className="flex items-start gap-3 text-small">
        <input
          type="checkbox"
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className="mt-1 size-4 shrink-0 accent-clay"
          {...input}
        />
        <span>
          {t.rich('consent.label', {
            purpose: t(`consent.purposes.${purpose}`),
            link: (chunks) => (
              <Link
                href="/chinh-sach-quyen-rieng-tu"
                target="_blank"
                rel="noreferrer"
                className="text-clay underline underline-offset-4"
              >
                {chunks}
              </Link>
            ),
          })}
        </span>
      </label>
      {error ? (
        <span id={errorId} role="alert" className="pl-7 text-small text-seal">
          {error}
        </span>
      ) : null}
    </div>
  );
}
