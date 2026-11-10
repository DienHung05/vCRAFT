'use client';

import { ApiError, type PaymentClient } from '@vcraft/api-client';
import type { AdminPaymentDto, AdminPaymentListQuery } from '@vcraft/contracts';
import { Button, Card } from '@vcraft/ui';
import { useFormatter, useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';
import { EmptyState } from '@/components/states/empty-state';
import { ErrorState } from '@/components/states/error-state';
import { ListSkeleton } from '@/components/states/skeletons';
import { PaymentStatusBadge } from '@/features/payments/payment-parts';
import { Link } from '@/i18n/navigation';
import { usePaymentClient } from '@/lib/api/use-payment-client';
import { useLatestRequest } from '@/lib/use-latest-request';
import { useMoney } from '@/lib/use-money';

const STATUSES = ['PENDING', 'PAID', 'FAILED', 'EXPIRED', 'CANCELLED', 'REFUNDED'] as const;
const METHODS = ['SEPAY_TRANSFER', 'VNPAY', 'MOMO', 'OFFLINE'] as const;
const KINDS = ['DEPOSIT', 'BALANCE'] as const;

/** All payments of all orders, newest first, with filters (ADR-0021 slice 6). Read-only. */
export function AdminPaymentsList({ client: provided }: { client?: PaymentClient }) {
  const t = useTranslations('admin.payments');
  const kinds = useTranslations('payments.kind');
  const methods = useTranslations('payments.method');
  const statuses = useTranslations('payments.status');
  const format = useFormatter();
  const money = useMoney();
  const { client, loading } = usePaymentClient(provided);
  const [filters, setFilters] = useState<Pick<AdminPaymentListQuery, 'status' | 'method' | 'kind'>>(
    {},
  );
  const [rows, setRows] = useState<AdminPaymentDto[]>([]);
  const [next, setNext] = useState<string | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error' | 'signed-out'>('loading');

  const latest = useLatestRequest();

  const load = useCallback(
    async (cursor?: string) => {
      if (!client) return;
      // A fresh load supersedes everything earlier; "load more" belongs to the list it extends.
      const id = cursor ? latest.peek() : latest.begin();
      try {
        const page = await client.adminPayments({ ...filters, ...(cursor && { cursor }) });
        if (!latest.isCurrent(id)) return;
        setRows((current) => (cursor ? [...current, ...page.data] : page.data));
        setNext(page.nextCursor);
        setState('ready');
      } catch (error) {
        if (!latest.isCurrent(id)) return;
        setState(error instanceof ApiError && error.status === 401 ? 'signed-out' : 'error');
      }
    },
    [client, filters, latest],
  );

  useEffect(() => {
    if (loading) return;
    if (!client) {
      setState('signed-out');
      return;
    }
    setState('loading');
    void load();
  }, [client, load, loading]);

  const select = <K extends keyof typeof filters>(
    key: K,
    label: string,
    all: string,
    values: readonly string[],
    text: (value: string) => string,
  ) => (
    <label className="flex flex-col gap-1 text-small">
      <span className="text-ash">{label}</span>
      <select
        value={filters[key] ?? ''}
        onChange={(event) => {
          const value = event.target.value;
          setFilters((current) => {
            const { [key]: _removed, ...rest } = current;
            return value ? ({ ...rest, [key]: value } as typeof current) : rest;
          });
        }}
        className="h-11 rounded-input border border-ink/20 bg-paper px-3 text-body"
      >
        <option value="">{all}</option>
        {values.map((value) => (
          <option key={value} value={value}>
            {text(value)}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <section className="flex max-w-6xl flex-col gap-6" data-testid="admin-payments">
      <header className="flex flex-col gap-2">
        <h1 className="text-h2">{t('title')}</h1>
        <p className="text-ash">{t('lead')}</p>
      </header>
      <fieldset className="flex flex-wrap gap-4">
        <legend className="sr-only">{t('filters')}</legend>
        {select('status', t('status'), t('allStatuses'), STATUSES, (value) =>
          statuses(value as 'PAID'),
        )}
        {select('method', t('method'), t('allMethods'), METHODS, (value) =>
          methods(value as 'OFFLINE'),
        )}
        {select('kind', t('kind'), t('allKinds'), KINDS, (value) => kinds(value as 'DEPOSIT'))}
      </fieldset>
      {state === 'loading' ? <ListSkeleton label="…" className="" rows={3} /> : null}
      {state === 'signed-out' ? <p>{t('signIn')}</p> : null}
      {state === 'error' ? <ErrorState message={t('failed')} onRetry={() => void load()} /> : null}
      {state === 'ready' && rows.length === 0 ? (
        <EmptyState illustration="scroll" headingLevel="h2" title={t('empty')} description="" />
      ) : null}
      {state === 'ready' && rows.length > 0 ? (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-left text-small">
            <thead className="border-b border-ink/10 text-ash">
              <tr>
                <th className="p-3 font-medium">{t('columns.when')}</th>
                <th className="p-3 font-medium">{t('columns.order')}</th>
                <th className="p-3 font-medium">{t('columns.buyer')}</th>
                <th className="p-3 font-medium">{t('columns.kind')}</th>
                <th className="p-3 font-medium">{t('columns.method')}</th>
                <th className="p-3 text-right font-medium">{t('columns.amount')}</th>
                <th className="p-3 font-medium">{t('columns.status')}</th>
                <th className="p-3 font-medium">{t('columns.reference')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((payment) => (
                <tr key={payment.id} className="border-b border-ink/5 align-top">
                  <td className="p-3">{format.dateTime(new Date(payment.createdAt), 'stamp')}</td>
                  <td className="p-3">
                    <Link
                      href={{
                        pathname: '/admin/dieu-phoi/[code]',
                        params: { code: payment.orderId },
                      }}
                      className="underline"
                    >
                      {payment.orderTitle ?? t('openOrder')}
                    </Link>
                  </td>
                  <td className="p-3">{payment.buyerName}</td>
                  <td className="p-3">{kinds(payment.kind)}</td>
                  <td className="p-3">{methods(payment.method)}</td>
                  <td className="p-3 text-right">{money(payment.amountVnd)}</td>
                  <td className="p-3">
                    <PaymentStatusBadge status={payment.status} />
                  </td>
                  <td className="p-3 font-mono">{payment.referenceCode}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      ) : null}
      {next ? (
        <Button
          type="button"
          variant="secondary"
          className="self-start"
          onClick={() => void load(next)}
        >
          {t('more')}
        </Button>
      ) : null}
    </section>
  );
}
