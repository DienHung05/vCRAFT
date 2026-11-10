'use client';

import type { AccountClient } from '@vcraft/api-client';
import { type ConsentDto, WITHDRAWABLE_CONSENT_PURPOSES } from '@vcraft/contracts';
import { Button } from '@vcraft/ui';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useId, useState } from 'react';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { FormAlert } from '@/features/auth/fields';
import { browserAccountClient } from '@/lib/auth/supabase-browser';
import { notify } from '@/lib/notify';

type WithdrawablePurpose = (typeof WITHDRAWABLE_CONSENT_PURPOSES)[number];

export interface ConsentWithdrawalCardProps {
  /** Only for tests. */
  client?: AccountClient;
}

/**
 * Withdraw consent per purpose (Decree 13/2023/ND-CP Art. 12). Each purpose shows what stops working;
 * withdrawing asks for confirmation. Only purposes with a standing consent are listed.
 */
export function ConsentWithdrawalCard({ client: provided }: ConsentWithdrawalCardProps) {
  const t = useTranslations('privacy.account.consents');
  const headingId = useId();
  const [consents, setConsents] = useState<ConsentDto[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [pending, setPending] = useState<WithdrawablePurpose | null>(null);
  const [working, setWorking] = useState(false);
  const [failed, setFailed] = useState(false);

  const api = useCallback(() => provided ?? browserAccountClient(), [provided]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await api().listConsents();
        if (!cancelled) setConsents(list.data);
      } catch {
        if (!cancelled) setLoadFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [api]);

  const standing = WITHDRAWABLE_CONSENT_PURPOSES.filter((purpose) =>
    consents?.some((row) => row.purpose === purpose && row.withdrawnAt === null),
  );

  const close = () => {
    if (working) return;
    setPending(null);
    setFailed(false);
  };

  const withdraw = async () => {
    if (!pending || working) return;
    setWorking(true);
    setFailed(false);
    try {
      const list = await api().withdrawConsent(pending);
      setConsents(list.data);
      notify.success(t('done'));
      setPending(null);
    } catch {
      setFailed(true);
    } finally {
      setWorking(false);
    }
  };

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-2">
      <h3 id={headingId} className="font-medium">
        {t('title')}
      </h3>
      <p className="text-ash text-small">{t('text')}</p>
      <p className="text-ash text-small">{t('signUpNote')}</p>
      {loadFailed ? <FormAlert tone="error">{t('loadFailed')}</FormAlert> : null}
      {consents && standing.length === 0 ? (
        <p className="text-ash text-small">{t('none')}</p>
      ) : null}
      <ul className="flex flex-col gap-3">
        {standing.map((purpose) => (
          <li key={purpose} className="flex flex-col gap-1">
            <span className="font-medium text-small">{t(`purposes.${purpose}.title`)}</span>
            <span className="text-ash text-small">{t(`purposes.${purpose}.effect`)}</span>
            <div>
              <Button
                type="button"
                variant="secondary"
                aria-label={`${t('withdraw')}: ${t(`purposes.${purpose}.title`)}`}
                onClick={() => setPending(purpose)}
              >
                {t('withdraw')}
              </Button>
            </div>
          </li>
        ))}
      </ul>

      <ConfirmDialog
        open={pending !== null}
        title={t('dialogTitle')}
        confirmLabel={working ? t('working') : t('confirm')}
        cancelLabel={t('cancel')}
        tone="seal"
        confirmDisabled={working}
        onConfirm={() => void withdraw()}
        onClose={close}
      >
        {pending ? (
          <>
            <p className="font-medium text-small">{t(`purposes.${pending}.title`)}</p>
            <p className="text-ash text-small">{t(`purposes.${pending}.effect`)}</p>
          </>
        ) : null}
        {failed ? <FormAlert tone="error">{t('failed')}</FormAlert> : null}
      </ConfirmDialog>
    </section>
  );
}
