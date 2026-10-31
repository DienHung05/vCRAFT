'use client';

import type { AdminClient, AdminHouseholdFilters } from '@vcraft/api-client';
import type { AdminHouseholdDto } from '@vcraft/contracts';
import { HOUSEHOLD_STATUSES, type HouseholdStatus } from '@vcraft/domain';
import { Badge, Button } from '@vcraft/ui';
import { useFormatter, useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';
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
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    if (!client) return;
    setFailed(false);
    try {
      setRows(await client.listHouseholds(filters));
    } catch {
      setFailed(true);
    }
  }, [client, filters]);

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
        <div role="alert" className="flex flex-col items-start gap-3">
          <p>{t('failed')}</p>
          <Button type="button" variant="secondary" onClick={() => void load()}>
            {t('retry')}
          </Button>
        </div>
      ) : rows === null ? (
        <p role="status">{t('loading')}</p>
      ) : rows.length === 0 ? (
        <p className="text-ash">{t('empty')}</p>
      ) : (
        <ul className="flex flex-col" data-testid="household-queue">
          {rows.map((row) => (
            <li key={row.id} className="border-ink/10 border-b last:border-b-0">
              <Link
                href={{ pathname: '/admin/duyet-ho/[id]', params: { id: row.id } }}
                className="flex min-h-14 flex-wrap items-center justify-between gap-3 py-3 hover:text-clay"
              >
                <span className="font-medium">{row.name}</span>
                <span className="flex items-center gap-3 text-small text-ash">
                  <time dateTime={row.submittedAt}>
                    {format.dateTime(new Date(row.submittedAt), 'short')}
                  </time>
                  <Badge tone={row.status === 'PENDING_REVIEW' ? 'lacquer' : 'outline'}>
                    {statuses(row.status)}
                  </Badge>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
