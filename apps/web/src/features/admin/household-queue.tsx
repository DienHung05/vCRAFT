'use client';

import type { AdminClient, AdminHouseholdFilters } from '@vcraft/api-client';
import type { AdminHouseholdDto } from '@vcraft/contracts';
import { HOUSEHOLD_STATUSES, type HouseholdStatus } from '@vcraft/domain';
import { Badge, Button } from '@vcraft/ui';
import { useFormatter, useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';
import { EmptyState } from '@/components/states/empty-state';
import { ErrorState } from '@/components/states/error-state';
import { TableSkeleton } from '@/components/states/skeletons';
import { Link } from '@/i18n/navigation';
import { useAdminClient } from './admin-dashboard';

const inputClass = 'rounded-input border border-ink/20 bg-surface px-2 py-1.5';

/** Hàng đợi duyệt hộ (FR-ADM-01): lọc theo trạng thái và ngày nộp; mặc định là hồ sơ đang chờ. */
export function HouseholdQueue({ client: provided }: { client?: AdminClient }) {
  const t = useTranslations('admin.queue');
  const statuses = useTranslations('studio.home.statuses');
  const format = useFormatter();
  const { client, loading } = useAdminClient(provided);
  const [filters, setFilters] = useState<AdminHouseholdFilters>({ status: 'PENDING_REVIEW' });
  const [rows, setRows] = useState<readonly AdminHouseholdDto[] | null>(null);
  const [next, setNext] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(
    async (cursor?: string) => {
      if (!client) return;
      setFailed(false);
      try {
        const page = await client.listHouseholds({ ...filters, ...(cursor && { cursor }) });
        setRows((current) => (cursor ? [...(current ?? []), ...page.data] : page.data));
        setNext(page.nextCursor);
      } catch {
        setFailed(true);
      }
    },
    [client, filters],
  );

  useEffect(() => {
    void load();
  }, [load]);

  if (!loading && !client) return <p>{t('signIn')}</p>;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-h2">{t('title')}</h1>
      <form
        aria-label={t('filters')}
        className="flex flex-wrap items-end gap-4"
        onSubmit={(event) => event.preventDefault()}
      >
        <label className="flex flex-col gap-1 text-small">
          {t('status')}
          <select
            value={filters.status ?? ''}
            onChange={(event) =>
              setFilters({
                ...filters,
                status: (event.target.value || undefined) as HouseholdStatus | undefined,
              })
            }
            className={inputClass}
          >
            <option value="">{t('allStatuses')}</option>
            {HOUSEHOLD_STATUSES.map((status) => (
              <option key={status} value={status}>
                {statuses(status)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-small">
          {t('from')}
          <input
            type="date"
            value={filters.from ?? ''}
            onChange={(event) => setFilters({ ...filters, from: event.target.value || undefined })}
            className={inputClass}
          />
        </label>
        <label className="flex flex-col gap-1 text-small">
          {t('to')}
          <input
            type="date"
            value={filters.to ?? ''}
            onChange={(event) => setFilters({ ...filters, to: event.target.value || undefined })}
            className={inputClass}
          />
        </label>
      </form>
      {failed ? (
        <ErrorState message={t('failed')} onRetry={() => void load()} />
      ) : rows === null ? (
        <TableSkeleton label={t('loading')} className="" withHeader={false} />
      ) : rows.length === 0 ? (
        <EmptyState
          illustration="scroll"
          title={t('empty')}
          description={t('emptyHint')}
          action={
            filters.status === 'PENDING_REVIEW' && !filters.from && !filters.to ? (
              <Button type="button" variant="secondary" onClick={() => setFilters({})}>
                {t('showAll')}
              </Button>
            ) : (
              <Button
                type="button"
                variant="secondary"
                onClick={() => setFilters({ status: 'PENDING_REVIEW' })}
              >
                {t('showPending')}
              </Button>
            )
          }
        />
      ) : (
        <ul className="flex flex-col" data-testid="household-queue">
          {rows.map((row) => (
            <li key={row.id} className="border-ink/10 border-b last:border-b-0">
              <Link
                href={{ pathname: '/admin/duyet-ho/[id]', params: { id: row.id } }}
                className="flex min-h-14 min-w-0 flex-wrap items-center justify-between gap-3 py-3 hover:text-clay"
              >
                <span className="min-w-0 flex-1 basis-40 truncate font-medium">{row.name}</span>
                <span className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-small text-ash">
                  <time dateTime={row.submittedAt}>
                    {format.dateTime(new Date(row.submittedAt), 'short')}
                  </time>
                  <Badge tone={row.status === 'PENDING_REVIEW' ? 'lacquer' : 'outline'}>
                    {statuses(row.status)}
                  </Badge>
                  {row.status === 'PENDING_REVIEW' &&
                  row.reviewState &&
                  row.reviewState !== 'NEW' ? (
                    <Badge tone={row.reviewState === 'RESUBMITTED' ? 'celadon' : 'clay'}>
                      {t(`reviewState.${row.reviewState}`)}
                    </Badge>
                  ) : null}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {next && !failed ? (
        <Button
          type="button"
          variant="secondary"
          className="self-start"
          onClick={() => void load(next)}
        >
          {t('more')}
        </Button>
      ) : null}
    </div>
  );
}
