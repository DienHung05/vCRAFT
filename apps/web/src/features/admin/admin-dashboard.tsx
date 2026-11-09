'use client';

import { type AdminClient, ApiError, createAdminClient } from '@vcraft/api-client';
import type { AdminDashboardDto } from '@vcraft/contracts';
import { Card } from '@vcraft/ui';
import { useFormatter, useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';
import { ErrorState } from '@/components/states/error-state';
import { DashboardSkeleton } from '@/components/states/skeletons';
import { Link } from '@/i18n/navigation';
import { useLiveClient } from '@/lib/api/live-session';
import { AssistantStatsCard } from './assistant-stats-card';

const REFRESH_MS = 30_000;

export function useAdminClient(provided?: AdminClient) {
  return useLiveClient(provided, (getAccessToken) => createAdminClient({ getAccessToken }));
}

const METRICS = [
  'activeHouseholds',
  'pendingApplications',
  'openRfqs',
  'ordersInProduction',
  'qrScans30Days',
] as const;

/** The dashboard's QR-scan trend: 30 Vietnam calendar dates, oldest first (FR-ADM-06, vCRAFT-8my.4). */
function DashboardTrendCard({ trend }: { trend: NonNullable<AdminDashboardDto['trend']> }) {
  const t = useTranslations('admin.dashboard');
  const format = useFormatter();
  const peak = Math.max(1, ...trend.map((point) => point.count));
  return (
    <Card className="flex flex-col gap-4 p-4 md:p-6" aria-labelledby="dashboard-trend-title">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="dashboard-trend-title" className="font-display text-h3">
          {t('trendTitle')}
        </h2>
        <p className="text-small text-ash">{t('trendPeriod')}</p>
      </div>
      {trend.every((point) => point.count === 0) ? (
        <p className="text-small text-ash">{t('trendEmpty')}</p>
      ) : (
        <>
          <div role="img" aria-label={t('trendChart')} className="flex h-24 items-end gap-0.5">
            {trend.map((point) => (
              <div
                key={point.date}
                title={`${point.date}: ${point.count}`}
                className="min-h-px flex-1 rounded-t-sm bg-seal"
                style={{ height: `${Math.max(2, (point.count / peak) * 100)}%` }}
              />
            ))}
          </div>
          {/* The table is what screen readers get; the bars carry the same numbers as tooltips.
              It sits in a sr-only wrapper so its wide content cannot stretch narrow screens. */}
          <div className="sr-only">
            <table>
              <caption>{t('trendTableCaption')}</caption>
              <thead>
                <tr>
                  <th scope="col">{t('trendDate')}</th>
                  <th scope="col">{t('trendCount')}</th>
                </tr>
              </thead>
              <tbody>
                {trend.map((point) => (
                  <tr key={point.date}>
                    <th scope="row">{point.date}</th>
                    <td>{format.number(point.count)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Card>
  );
}

/** Tổng quan của Ban quản lý (FR-ADM-06): số liệu tự cập nhật, không cần tải lại trang. */
export function AdminDashboard({ client: provided }: { client?: AdminClient }) {
  const t = useTranslations('admin.dashboard');
  const format = useFormatter();
  const { client, loading } = useAdminClient(provided);
  const [data, setData] = useState<AdminDashboardDto | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error' | 'signed-out'>('loading');

  const load = useCallback(async () => {
    if (!client) return;
    try {
      setData(await client.dashboard());
      setState('ready');
    } catch (error) {
      setState(error instanceof ApiError && error.status === 401 ? 'signed-out' : 'error');
    }
  }, [client]);

  useEffect(() => {
    if (loading) return;
    if (!client) {
      setState('signed-out');
      return;
    }
    void load();
    const timer = window.setInterval(() => {
      if (!document.hidden) void load();
    }, REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [client, load, loading]);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-h2">{t('title')}</h1>
      {state === 'loading' ? (
        <DashboardSkeleton label={t('loading')} className="" withTitle={false} />
      ) : null}
      {state === 'signed-out' ? <p>{t('signIn')}</p> : null}
      {state === 'error' && !data ? (
        <ErrorState message={t('failed')} onRetry={() => void load()} />
      ) : null}
      {data ? (
        <>
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5" data-testid="admin-metrics">
            {METRICS.map((key) => (
              <Card key={key} className="p-4">
                <dt className="text-small text-ash">{t(key)}</dt>
                <dd className="mt-1 font-display text-h1">{format.number(data[key])}</dd>
              </Card>
            ))}
          </dl>
          {data.pendingApplications > 0 ? (
            <Link
              href="/admin/duyet-ho"
              className="self-start text-clay underline underline-offset-4"
            >
              {t('reviewCta', { count: data.pendingApplications })}
            </Link>
          ) : null}
          {client ? <AssistantStatsCard client={client} /> : null}
          {data.trend ? <DashboardTrendCard trend={data.trend} /> : null}
        </>
      ) : null}
    </div>
  );
}
