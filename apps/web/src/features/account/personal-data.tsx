'use client';

import { AccountApiError, type AccountClient } from '@vcraft/api-client';
import { Button } from '@vcraft/ui';
import { useLocale, useTranslations } from 'next-intl';
import { useId, useState } from 'react';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { FormAlert } from '@/features/auth/fields';
import { getPathname } from '@/i18n/navigation';
import { browserAccountClient, browserSupabase } from '@/lib/auth/supabase-browser';
import { notify } from '@/lib/notify';
import { clearAllStoredRfqDrafts } from '@/lib/rfq-draft-storage';

const inputClass = 'w-full rounded-input border border-ink/20 bg-surface px-3 py-2';

type DeleteError = 'blockedOrders' | 'blockedAdmin' | 'mismatch' | 'failed';

const ERROR_OF_CODE: Partial<Record<string, DeleteError>> = {
  ACCOUNT_DELETION_ACTIVE_ORDERS: 'blockedOrders',
  ACCOUNT_DELETION_ADMIN: 'blockedAdmin',
  VALIDATION_FAILED: 'mismatch',
};

/** Hands a JSON document to the browser as a file download. */
function saveJson(filename: string, data: unknown) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }),
  );
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export interface PersonalDataCardProps {
  /** The signed-in account's email: the deletion is confirmed by typing it. */
  email: string;
  accountRole: 'ADMIN' | 'HOUSEHOLD' | 'BUYER';
  /** Only for tests. */
  client?: AccountClient;
  /** Runs after the account was deleted. Default: drop the local session and go to the home page. */
  onDeleted?: () => void | Promise<void>;
}

/**
 * Download and deletion of the person's own data (NFR-SEC-07). Deleting is permanent, so it sits behind
 * a confirm dialog that asks for the account email; the API checks it again.
 */
export function PersonalDataCard({
  email,
  accountRole,
  client: provided,
  onDeleted: provideOnDeleted,
}: PersonalDataCardProps) {
  const t = useTranslations('privacy.account');
  const locale = useLocale();
  const inputId = useId();
  const [downloading, setDownloading] = useState(false);
  const [downloadFailed, setDownloadFailed] = useState(false);
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<DeleteError | null>(null);

  const api = () => provided ?? browserAccountClient();

  const download = async () => {
    setDownloading(true);
    setDownloadFailed(false);
    try {
      const data = await api().exportMyData();
      saveJson(`vcraft-my-data-${data.exportedAt.slice(0, 10)}.json`, data);
      notify.success(t('download.done'));
    } catch {
      setDownloadFailed(true);
    } finally {
      setDownloading(false);
    }
  };

  const close = () => {
    if (deleting) return;
    setOpen(false);
    setTyped('');
    setError(null);
  };

  const matches = typed.trim().toLowerCase() === email.trim().toLowerCase();

  const remove = async () => {
    if (!matches || deleting) return;
    setDeleting(true);
    setError(null);
    try {
      await api().deleteAccount(typed.trim());
    } catch (failure) {
      setError(
        (failure instanceof AccountApiError ? ERROR_OF_CODE[failure.code] : undefined) ?? 'failed',
      );
      setDeleting(false);
      return;
    }
    notify.success(t('delete.done'));
    if (provideOnDeleted) {
      await provideOnDeleted();
      return;
    }
    clearAllStoredRfqDrafts();
    try {
      // The identity is already gone at Supabase, so only the local session is dropped.
      await browserSupabase()?.auth.signOut({ scope: 'local' });
    } finally {
      window.location.assign(getPathname({ href: '/', locale: locale as 'vi' | 'en' }));
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby={`${inputId}-download`} className="flex flex-col gap-2">
        <h3 id={`${inputId}-download`} className="font-medium">
          {t('download.title')}
        </h3>
        <p className="text-ash text-small">{t('download.text')}</p>
        {downloadFailed ? <FormAlert tone="error">{t('download.failed')}</FormAlert> : null}
        <div>
          <Button
            type="button"
            variant="secondary"
            disabled={downloading}
            onClick={() => void download()}
          >
            {downloading ? t('download.working') : t('download.button')}
          </Button>
        </div>
      </section>

      <section aria-labelledby={`${inputId}-delete`} className="flex flex-col gap-2">
        <h3 id={`${inputId}-delete`} className="font-medium">
          {t('delete.title')}
        </h3>
        <p className="text-ash text-small">{t('delete.text')}</p>
        <p className="text-ash text-small">{t('delete.removed')}</p>
        <p className="text-ash text-small">{t('delete.kept')}</p>
        {accountRole === 'ADMIN' ? (
          <p className="text-small">{t('delete.blockedAdmin')}</p>
        ) : (
          <div>
            <Button type="button" variant="seal" onClick={() => setOpen(true)}>
              {t('delete.button')}
            </Button>
          </div>
        )}
      </section>

      <ConfirmDialog
        open={open}
        title={t('delete.dialogTitle')}
        confirmLabel={deleting ? t('delete.working') : t('delete.confirm')}
        cancelLabel={t('delete.cancel')}
        tone="seal"
        confirmDisabled={!matches || deleting}
        onConfirm={() => void remove()}
        onClose={close}
      >
        <p className="text-ash text-small">{t('delete.text')}</p>
        <label htmlFor={inputId} className="flex flex-col gap-1 text-small">
          {t('delete.typeLabel')}
          <input
            id={inputId}
            type="email"
            autoComplete="off"
            spellCheck={false}
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            className={inputClass}
          />
          <span className="text-ash">{t('delete.typeHint', { email })}</span>
        </label>
        {error ? <FormAlert tone="error">{t(`delete.${error}`)}</FormAlert> : null}
      </ConfirmDialog>
    </div>
  );
}
