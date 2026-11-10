'use client';

import { ApiError, type PaymentClient } from '@vcraft/api-client';
import type { UnappliedPaymentDto } from '@vcraft/contracts';
import { Badge, Button, Card } from '@vcraft/ui';
import { useFormatter, useTranslations } from 'next-intl';
import { useCallback, useEffect, useId, useState } from 'react';
import { Link } from '@/i18n/navigation';
import { notify } from '@/lib/notify';
import { useMoney } from '@/lib/use-money';

/**
 * Money that came in but could not be applied (GH#417): a wrong amount, a transfer to a cancelled payment, or a
 * second payment of an order already paid. Each stays here until an administrator records how it was handled.
 */
export function AdminUnappliedPayments({ client }: { client: PaymentClient }) {
  const t = useTranslations('admin.payments.unapplied');
  const format = useFormatter();
  const money = useMoney();
  const [rows, setRows] = useState<UnappliedPaymentDto[] | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    try {
      const page = await client.unappliedPayments({ status: 'OPEN' });
      setRows(page.data);
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, [client]);

  useEffect(() => {
    void load();
  }, [load]);

  if (failed)
    return (
      <p role="alert" className="text-small text-seal">
        {t('failed')}{' '}
        <button type="button" className="underline" onClick={() => void load()}>
          {t('retry')}
        </button>
      </p>
    );
  if (rows === null || rows.length === 0) return null;
  return (
    <Card className="flex flex-col gap-4 p-5" data-testid="admin-unapplied-payments">
      <header className="flex flex-col gap-1">
        <h2 className="text-h3">{t('title', { count: rows.length })}</h2>
        <p className="text-small text-ash">{t('lead')}</p>
      </header>
      <ul className="flex flex-col gap-4">
        {rows.map((row) => (
          <UnappliedRow
            key={row.id}
            row={row}
            client={client}
            onResolved={() => setRows((current) => current?.filter((r) => r.id !== row.id) ?? null)}
            onStale={() => void load()}
            when={format.dateTime(new Date(row.receivedAt), 'stamp')}
            amount={money(row.amountVnd)}
            expected={row.expectedAmountVnd === null ? null : money(row.expectedAmountVnd)}
          />
        ))}
      </ul>
    </Card>
  );
}

function UnappliedRow({
  row,
  client,
  onResolved,
  onStale,
  when,
  amount,
  expected,
}: {
  row: UnappliedPaymentDto;
  client: PaymentClient;
  onResolved: () => void;
  onStale: () => void;
  when: string;
  amount: string;
  expected: string | null;
}) {
  const t = useTranslations('admin.payments.unapplied');
  const id = useId();
  const [open, setOpen] = useState(false);
  const [resolution, setResolution] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<'short' | 'stale' | 'failed' | null>(null);

  const resolve = async () => {
    if (resolution.trim().length < 3) {
      setError('short');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await client.resolveUnappliedPayment(row.id, row.version, { resolution: resolution.trim() });
      notify.success(t('resolved'));
      onResolved();
    } catch (failure) {
      const stale = failure instanceof ApiError && failure.status === 409;
      setError(stale ? 'stale' : 'failed');
      if (stale) onStale();
    } finally {
      setBusy(false);
    }
  };

  return (
    <li className="flex flex-col gap-2 border-ink/10 border-t pt-3" data-testid="unapplied-row">
      <div className="flex flex-wrap items-center gap-3">
        <Badge tone="seal">{t(`reason.${row.reason}`)}</Badge>
        <span className="font-medium">{amount}</span>
        {expected ? (
          <span className="text-small text-ash">{t('expected', { expected })}</span>
        ) : null}
        <span className="text-small text-ash">{when}</span>
        <span className="font-mono text-small">{row.referenceCode}</span>
        <span className="text-small text-ash">
          {row.provider} · {row.providerTxnId}
        </span>
        {row.orderId ? (
          <Link
            href={{ pathname: '/admin/dieu-phoi/[code]', params: { code: row.orderId } }}
            className="text-small underline"
          >
            {row.orderTitle ?? t('openOrder')}
          </Link>
        ) : null}
      </div>
      {open ? (
        <div className="flex flex-col gap-2">
          <label htmlFor={id} className="text-small">
            {t('resolutionLabel')}
          </label>
          <textarea
            id={id}
            value={resolution}
            onChange={(event) => setResolution(event.target.value)}
            placeholder={t('resolutionPlaceholder')}
            maxLength={500}
            rows={2}
            className="w-full rounded-input border border-ink/20 bg-paper px-3 py-2 text-body"
          />
          {error ? (
            <p role="alert" className="text-small text-seal">
              {t(`error.${error}`)}
            </p>
          ) : null}
          <div className="flex gap-2">
            <Button type="button" disabled={busy} onClick={() => void resolve()}>
              {t('confirm')}
            </Button>
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              {t('cancel')}
            </Button>
          </div>
        </div>
      ) : (
        <Button
          type="button"
          variant="secondary"
          className="self-start"
          onClick={() => setOpen(true)}
        >
          {t('resolve')}
        </Button>
      )}
    </li>
  );
}
