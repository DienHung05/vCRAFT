'use client';

import type { AccountClient } from '@vcraft/api-client';
import type { LoginEventDto } from '@vcraft/contracts';
import { Badge, Button } from '@vcraft/ui';
import { useFormatter, useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { clearRememberPreference } from '@/lib/auth/remember';
import { browserAccountClient, browserSupabase } from '@/lib/auth/supabase-browser';
import { clearAllStoredRfqDrafts } from '@/lib/rfq-draft-storage';

const KNOWN_METHODS = ['password', 'oauth', 'otp', 'recovery', 'invite'] as const;

/** Country name in the viewer's language; the bare code when the runtime does not know it. */
function countryName(code: string, locale: string): string {
  try {
    return new Intl.DisplayNames([locale], { type: 'region' }).of(code) ?? code;
  } catch {
    return code;
  }
}

/**
 * Account security (GH#83, GH#239): the recent sign-ins of this account with browser and rough
 * location, a button that signs out every other device and keeps this session (`scope: 'others'`, through
 * the API), and one that signs out every device, this one included (`scope: 'global'`). `limit` shows only
 * the newest rows. `client` is for tests.
 */
export function AccountSecurity({
  client: provided,
  limit,
}: {
  client?: AccountClient;
  limit?: number;
}) {
  const t = useTranslations('account.security');
  const format = useFormatter();
  const locale = useLocale();
  const [events, setEvents] = useState<LoginEventDto[] | null | 'error'>(null);
  const [confirming, setConfirming] = useState<'others' | 'all' | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ kind: 'done' | 'failed' } | null>(null);
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
    setBusy(true);
    await browserSupabase()?.auth.signOut({ scope: 'global' });
    clearRememberPreference();
    clearAllStoredRfqDrafts();
    window.location.assign(`/${locale}`);
  };

  const signOutOthers = async () => {
    setBusy(true);
    setNotice(null);
    try {
      const list = await (provided ?? browserAccountClient()).signOutOtherSessions();
      setEvents(list.items);
      setNotice({ kind: 'done' });
    } catch {
      setNotice({ kind: 'failed' });
    } finally {
      setBusy(false);
      setConfirming(null);
    }
  };

  const rows = Array.isArray(events) ? events.slice(0, limit ?? events.length) : [];

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h3 className="mb-2 font-medium">{t('historyTitle')}</h3>
        {events === null ? <p className="text-small text-ash">{t('loading')}</p> : null}
        {events === 'error' ? <p className="text-small text-ash">{t('unavailable')}</p> : null}
        {Array.isArray(events) && events.length === 0 ? (
          <p className="text-small text-ash">{t('empty')}</p>
        ) : null}
        {rows.length > 0 ? (
          <ul className="divide-y divide-ink/8 text-small" data-testid="login-events">
            {rows.map((event) => {
              const place = [
                event.browser ?? t('unknownBrowser'),
                event.country ? countryName(event.country, locale) : null,
              ]
                .filter(Boolean)
                .join(' · ');
              return (
                <li key={event.id} className="flex flex-col gap-1 py-2">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
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
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-ash">
                    <span>{place}</span>
                    {event.current ? <Badge tone="celadon">{t('current')}</Badge> : null}
                    {event.signedOutAt ? <Badge tone="outline">{t('signedOut')}</Badge> : null}
                  </div>
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>
      <div className="flex flex-col items-start gap-2">
        <p className="text-small text-ash">{t('signOutOthersLead')}</p>
        <Button
          type="button"
          variant="secondary"
          disabled={busy}
          onClick={() => setConfirming('others')}
        >
          {t('signOutOthers')}
        </Button>
        {notice ? (
          <p
            role={notice.kind === 'done' ? 'status' : 'alert'}
            className={notice.kind === 'done' ? 'text-small' : 'text-small text-seal'}
          >
            {notice.kind === 'done' ? t('othersDone') : t('othersFailed')}
          </p>
        ) : null}
      </div>
      <div className="flex flex-col items-start gap-2">
        <p className="text-small text-ash">{t('signOutLead')}</p>
        <Button
          type="button"
          variant="secondary"
          disabled={busy}
          onClick={() => setConfirming('all')}
        >
          {t('signOutAll')}
        </Button>
      </div>
      <ConfirmDialog
        open={confirming === 'all'}
        title={t('confirmTitle')}
        confirmLabel={t('signOutAll')}
        cancelLabel={t('cancel')}
        tone="seal"
        confirmDisabled={busy}
        onConfirm={() => void signOutEverywhere()}
        onClose={() => setConfirming(null)}
      >
        {t('confirmText')}
      </ConfirmDialog>
      <ConfirmDialog
        open={confirming === 'others'}
        title={t('othersTitle')}
        confirmLabel={t('signOutOthers')}
        cancelLabel={t('cancel')}
        confirmDisabled={busy}
        onConfirm={() => void signOutOthers()}
        onClose={() => setConfirming(null)}
      >
        {t('othersText')}
      </ConfirmDialog>
    </div>
  );
}
