'use client';

import type { AccountClient } from '@vcraft/api-client';
import type { LoginEventDto } from '@vcraft/contracts';
import { Button } from '@vcraft/ui';
import { useFormatter, useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { clearRememberPreference } from '@/lib/auth/remember';
import { browserAccountClient, browserSupabase } from '@/lib/auth/supabase-browser';

const KNOWN_METHODS = ['password', 'oauth', 'otp', 'recovery', 'invite'] as const;

/**
 * Account security (GH#83): the last sign-ins of this account, and a button that signs it out of every
 * device, this one included (`scope: 'global'` revokes every refresh token). `client` is for tests.
 */
export function AccountSecurity({ client: provided }: { client?: AccountClient }) {
  const t = useTranslations('account.security');
  const format = useFormatter();
  const locale = useLocale();
  const [events, setEvents] = useState<LoginEventDto[] | null | 'error'>(null);
  const [confirming, setConfirming] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  // Methods outside the known list (Supabase may add some) show as Supabase names them.
  const methodLabel = (method: string) =>
    (KNOWN_METHODS as readonly string[]).includes(method)
      ? t(`method.${method as (typeof KNOWN_METHODS)[number]}`)
      : method;

  useEffect(() => {
    let live = true;
    (provided ?? browserAccountClient())
      .loginEvents()
      .then((list) => live && setEvents(list.items))
      .catch(() => live && setEvents('error'));
    return () => {
      live = false;
    };
  }, [provided]);

  const signOutEverywhere = async () => {
    setSigningOut(true);
    await browserSupabase()?.auth.signOut({ scope: 'global' });
    clearRememberPreference();
    window.location.assign(`/${locale}`);
  };

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h3 className="mb-2 font-medium">{t('historyTitle')}</h3>
        {events === null ? <p className="text-small text-ash">{t('loading')}</p> : null}
        {events === 'error' ? <p className="text-small text-ash">{t('unavailable')}</p> : null}
        {Array.isArray(events) && events.length === 0 ? (
          <p className="text-small text-ash">{t('empty')}</p>
        ) : null}
        {Array.isArray(events) && events.length > 0 ? (
          <ul className="divide-y divide-ink/8 text-small">
            {events.map((event) => (
              <li
                key={event.id}
                className="flex flex-wrap items-baseline justify-between gap-2 py-2"
              >
                <time dateTime={event.createdAt}>
                  {format.dateTime(new Date(event.createdAt), {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })}
                </time>
                <span className="text-ash">
                  {methodLabel(event.method)}
                  {event.aal === 'aal2' ? ` · ${t('twoFactor')}` : ''}
                </span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      <div className="flex flex-col items-start gap-2">
        <p className="text-small text-ash">{t('signOutLead')}</p>
        <Button
          type="button"
          variant="secondary"
          disabled={signingOut}
          onClick={() => setConfirming(true)}
        >
          {t('signOutAll')}
        </Button>
      </div>
      <ConfirmDialog
        open={confirming}
        title={t('confirmTitle')}
        confirmLabel={t('signOutAll')}
        cancelLabel={t('cancel')}
        tone="seal"
        confirmDisabled={signingOut}
        onConfirm={() => void signOutEverywhere()}
        onClose={() => setConfirming(false)}
      >
        {t('confirmText')}
      </ConfirmDialog>
    </div>
  );
}
