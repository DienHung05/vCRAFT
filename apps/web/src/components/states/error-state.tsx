'use client';

import { Button, cn } from '@vcraft/ui';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

export interface ErrorStateProps {
  /** Specific explanation of what failed; defaults to the generic "could not load" text. */
  message?: string | undefined;
  /** Retry handler of a client-loaded block. */
  onRetry?: (() => void) | undefined;
  /** Replaces the retry button, e.g. `<RetryLink />` for a server-rendered block. */
  action?: ReactNode;
  className?: string | undefined;
}

/**
 * Shared error block for any data block: says what went wrong and offers a retry (NFR-UX-05).
 * Client-loaded blocks pass `onRetry`; server-rendered ones go through `DataUnavailable`, whose
 * retry button refreshes the route's data.
 */
export function ErrorState({ message, onRetry, action, className }: ErrorStateProps) {
  const t = useTranslations('common');
  return (
    <div
      role="alert"
      data-testid="error-state"
      className={cn('flex flex-col items-start gap-3', className)}
    >
      <p className="text-ash">{message ?? t('dataUnavailable')}</p>
      {onRetry ? (
        <Button type="button" variant="secondary" onClick={onRetry}>
          {t('retry')}
        </Button>
      ) : (
        action
      )}
    </div>
  );
}
