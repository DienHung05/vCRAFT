'use client';

import { ApiError, type PaymentClient } from '@vcraft/api-client';
import type { UnappliedPaymentDto } from '@vcraft/contracts';
import { Button, Card } from '@vcraft/ui';
import { useFormatter, useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';
import { Link } from '@/i18n/navigation';
import { useMoney } from '@/lib/use-money';

/**
 * Money that arrived but no payment could take (GH#417): open items with the reason, and a note field to mark
 * each handled once the money has been returned or matched by hand. Nothing here moves money.
 */
export function AdminUnappliedPayments({ client }: { client: PaymentClient | null }) {
  const t = useTranslations('admin.payments.unapplied');
  const format = useFormatter();
  const money = useMoney();
  const [rows, setRows] = useState<UnappliedPaymentDto[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ id: string; text: string; ok: boolean } | null>(null);

  const load = useCallback(async () => {
    if (!client) return;
    try {
      const page = await client.unappliedPayments({ status: 'OPEN' });
      setRows(page.data);
      setState('ready');
    } catch {
      setState('error');
    }
  }, [client]);

  useEffect(() => {
    void load();
  }, [load]);

  const resolve = async (row: UnappliedPaymentDto) => {
    if (!client) return;
    const note = (notes[row.id] ?? '').trim();
    if (note.length < 3) {
      setMessage({ id: row.id, text: t('noteRequired'), ok: false });
      return;
    }
    setBusy(row.id);
    setMessage(null);
    try {
      await client.resolveUnappliedPayment(row.id, row.version, { note });
      setRows((current) => current.filter((item) => item.id !== row.id));
      setMessage({ id: row.id, text: t('resolved'), ok: true });
    } catch (cause) {
      const stale = cause instanceof ApiError && cause.code === 'STALE_VERSION';
      setMessage({ id: row.id, text: stale ? t('stale') : t('resolveFailed'), ok: false });
      if (stale) await load();
    } finally {
      setBusy(null);
    }
  };

  if (state === 'loading') return null;
  return (
    <section className="flex flex-col gap-3" data-testid="admin-unapplied-payments">
      <header className="flex flex-col gap-1">
        <h2 className="text-h3">{t('title')}</h2>
        <p className="text-ash">{t('lead')}</p>
      </header>
      {state === 'error' ? <p role="alert">{t('failed')}</p> : null}
      {state === 'ready' && rows.length === 0 ? <p className="text-ash">{t('empty')}</p> : null}
      {message?.ok ? <p role="status">{message.text}</p> : null}
      <ul className="flex flex-col gap-3">
        {rows.map((row) => (
          <li key={row.id}>
            <Card className="flex flex-col gap-2 border-l-4 border-l-red-700 p-4">
              <p className="font-medium">{t(`reasons.${row.reason}`)}</p>
              <p>
                {row.expectedAmountVnd !== null
                  ? t('received', {
                      amount: money(row.amountVnd),
                      expected: money(row.expectedAmountVnd),
                    })
                  : t('receivedOnly', { amount: money(row.amountVnd) })}
              </p>
              <p className="text-small text-ash">
                {format.dateTime(new Date(row.createdAt), 'stamp')} · {row.provider} ·{' '}
                {t('txn', { id: row.providerTxnId })}
                {row.referenceCode ? ` · ${t('code', { code: row.referenceCode })}` : ''}
              </p>
              {row.orderId ? (
                <Link
                  href={{ pathname: '/admin/dieu-phoi/[code]', params: { code: row.orderId } }}
                  className="self-start text-small underline"
                >
                  {row.orderTitle ?? '…'}
                </Link>
              ) : null}
              <label className="flex flex-col gap-1 text-small">
                <span className="text-ash">{t('noteLabel')}</span>
                <input
                  type="text"
                  value={notes[row.id] ?? ''}
                  maxLength={500}
                  onChange={(event) =>
                    setNotes((current) => ({ ...current, [row.id]: event.target.value }))
                  }
                  className="h-11 rounded-input border border-ink/20 bg-paper px-3 text-body"
                />
              </label>
              {message && !message.ok && message.id === row.id ? (
                <p role="alert" className="text-small text-red-700">
                  {message.text}
                </p>
              ) : null}
              <Button
                type="button"
                variant="secondary"
                className="self-start"
                disabled={busy === row.id}
                onClick={() => void resolve(row)}
              >
                {busy === row.id ? t('resolving') : t('resolve')}
              </Button>
            </Card>
          </li>
        ))}
      </ul>
    </section>
  );
}
