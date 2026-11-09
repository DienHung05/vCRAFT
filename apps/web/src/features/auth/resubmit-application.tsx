'use client';

import { AccountApiError, createAccountClient } from '@vcraft/api-client';
import { Button, Card } from '@vcraft/ui';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { browserAccessToken } from '@/lib/api/live-session';

/**
 * Explicit resubmission after the applicant answered an information request (vCRAFT-8my.2). The
 * component fetches the full private household itself at click time: the card only renders when the
 * auth summary still shows an active information request, and the resubmit reads the current version
 * from `GET /me/household`, so edits saved in another tab never make it fail with 409. A genuine race
 * with a board decision still answers 409 and the page reloads with the newest decision.
 */
export function ResubmitApplication({ householdId }: { householdId: string }) {
  const t = useTranslations('auth.profile.resubmit');
  const [state, setState] = useState<'idle' | 'busy' | 'stale' | 'failed'>('idle');

  const resubmit = async () => {
    setState('busy');
    try {
      const token = await (browserAccessToken() ?? (async () => null))();
      if (!token) throw new AccountApiError('AUTH_UNAUTHENTICATED', 401);
      const client = createAccountClient({ getAccessToken: async () => token });
      // The write needs the version of the record as it is now, not the page's server snapshot.
      const current = await client.getMyHousehold();
      if (current.id !== householdId || current.status !== 'PENDING_REVIEW') {
        // The board decided in the meantime; the reload below shows its decision.
        window.location.reload();
        return;
      }
      await client.resubmitHousehold(current.version);
      // Reload so the status card and queue state come from the server, not local guesses.
      window.location.reload();
    } catch (failure) {
      setState(failure instanceof AccountApiError && failure.status === 409 ? 'stale' : 'failed');
    }
  };

  return (
    <Card className="flex flex-col gap-3 p-5" data-household-id={householdId}>
      <h2 className="text-h3">{t('title')}</h2>
      <p className="text-ash">{t('lead')}</p>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" disabled={state === 'busy'} onClick={() => void resubmit()}>
          {state === 'busy' ? t('submitting') : t('submit')}
        </Button>
        {state === 'stale' ? (
          <p role="alert" className="text-small text-seal">
            {t('stale')}
          </p>
        ) : null}
        {state === 'failed' ? (
          <p role="alert" className="text-small text-seal">
            {t('failed')}
          </p>
        ) : null}
      </div>
    </Card>
  );
}
