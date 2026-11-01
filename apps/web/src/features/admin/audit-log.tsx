'use client';

import type { AdminClient } from '@vcraft/api-client';
import {
  AUDIT_ACTIONS,
  type AuditAction,
  type AuditActorDto,
  type AuditEntryDto,
  type AuditLogQuery,
} from '@vcraft/contracts';
import { Button, buttonVariants } from '@vcraft/ui';
import { useFormatter, useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';
import { EmptyState } from '@/components/states/empty-state';
import { ErrorState } from '@/components/states/error-state';
import { TableSkeleton } from '@/components/states/skeletons';
import { Link } from '@/i18n/navigation';
import { useAdminClient } from './admin-dashboard';

const inputClass = 'rounded-input border border-ink/20 bg-surface px-2 py-1.5';

type Filters = Pick<Partial<AuditLogQuery>, 'actorId' | 'action' | 'from' | 'to'>;

function Values({ values, empty }: { values: AuditEntryDto['before']; empty: string }) {
  const entries = Object.entries(values ?? {});
  if (entries.length === 0) return <span className="text-ash">{empty}</span>;
  return (
    <dl className="flex flex-col gap-0.5">
      {entries.map(([key, value]) => (
        <div key={key} className="flex flex-wrap gap-x-1.5">
          <dt className="text-ash">{key}:</dt>
          <dd className="min-w-0 break-all">
            {value === null
              ? empty
              : typeof value === 'object'
                ? JSON.stringify(value)
                : `${value}`}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function Target({ entry }: { entry: AuditEntryDto }) {
  const t = useTranslations('admin.audit');
  const key = `entity.${entry.entity}` as Parameters<typeof t>[0];
  const label = t.has(key) ? t(key) : entry.entity;
  const code = <span className="font-mono text-[0.7rem] break-all">{entry.entityId}</span>;
  if (entry.entity === 'household')
    return (
      <Link
        href={{ pathname: '/admin/duyet-ho/[id]', params: { id: entry.entityId } }}
        className="flex flex-col hover:text-clay"
      >
        <span>{label}</span>
        {code}
      </Link>
    );
  return (
    <span className="flex flex-col">
      <span>{label}</span>
      {code}
    </span>
  );
}

/** Audit log screen (FR-ADM-05): who, what, when, target and before/after values. */
export function AuditLogView({ client: provided }: { client?: AdminClient }) {
  const t = useTranslations('admin.audit');
  const format = useFormatter();
  const { client, loading } = useAdminClient(provided);
  const [filters, setFilters] = useState<Filters>({});
  const [actors, setActors] = useState<readonly AuditActorDto[]>([]);
  const [rows, setRows] = useState<readonly AuditEntryDto[] | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const load = useCallback(async () => {
    if (!client) return;
    setFailed(false);
    try {
      const page = await client.auditLog(filters);
      setRows(page.data);
      setCursor(page.nextCursor);
    } catch {
      setFailed(true);
    }
  }, [client, filters]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    client
      ?.auditActors()
      .then(setActors)
      .catch(() => {});
  }, [client]);

  if (!loading && !client) return <p>{t('signIn')}</p>;

  const actionLabel = (action: string) => {
    const key = `actions.${action}` as Parameters<typeof t>[0];
    return t.has(key) ? t(key) : action;
  };

  const more = async () => {
    if (!client || !cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await client.auditLog({ ...filters, cursor });
      setRows((current) => [...(current ?? []), ...page.data]);
      setCursor(page.nextCursor);
    } catch {
      setFailed(true);
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-h2">{t('title')}</h1>
        <p className="text-ash">{t('lead')}</p>
      </header>
      <form
        aria-label={t('filters')}
        className="flex flex-wrap items-end gap-4"
        onSubmit={(event) => event.preventDefault()}
      >
        <label className="flex flex-col gap-1 text-small">
          {t('actor')}
          <select
            value={filters.actorId ?? ''}
            onChange={(event) =>
              setFilters({ ...filters, actorId: event.target.value || undefined })
            }
            className={inputClass}
          >
            <option value="">{t('allActors')}</option>
            {actors.map((actor) => (
              <option key={actor.id} value={actor.id}>
                {actor.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-small">
          {t('action')}
          <select
            value={filters.action ?? ''}
            onChange={(event) =>
              setFilters({
                ...filters,
                action: (event.target.value || undefined) as AuditAction | undefined,
              })
            }
            className={inputClass}
          >
            <option value="">{t('allActions')}</option>
            {AUDIT_ACTIONS.map((action) => (
              <option key={action} value={action}>
                {t(`actions.${action}`)}
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
            Object.values(filters).some(Boolean) ? (
              <Button type="button" variant="secondary" onClick={() => setFilters({})}>
                {t('clearFilters')}
              </Button>
            ) : (
              <Link href="/admin" className={buttonVariants({ variant: 'secondary' })}>
                {t('emptyAction')}
              </Link>
            )
          }
        />
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[48rem] text-left text-small" data-testid="audit-log">
              <thead className="border-ink/20 border-b text-ash">
                <tr>
                  <th scope="col" className="py-2 pr-4 font-medium">
                    {t('when')}
                  </th>
                  <th scope="col" className="py-2 pr-4 font-medium">
                    {t('who')}
                  </th>
                  <th scope="col" className="py-2 pr-4 font-medium">
                    {t('what')}
                  </th>
                  <th scope="col" className="py-2 pr-4 font-medium">
                    {t('target')}
                  </th>
                  <th scope="col" className="py-2 pr-4 font-medium">
                    {t('before')}
                  </th>
                  <th scope="col" className="py-2 font-medium">
                    {t('after')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-ink/10 border-b align-top last:border-b-0">
                    <td className="py-3 pr-4 whitespace-nowrap">
                      <time dateTime={row.createdAt}>
                        {format.dateTime(new Date(row.createdAt), {
                          dateStyle: 'short',
                          timeStyle: 'short',
                        })}
                      </time>
                    </td>
                    <td className="py-3 pr-4">{row.actorName ?? t('unknownActor')}</td>
                    <td className="py-3 pr-4">{actionLabel(row.action)}</td>
                    <td className="py-3 pr-4">
                      <Target entry={row} />
                    </td>
                    <td className="py-3 pr-4">
                      <Values values={row.before} empty={t('noValue')} />
                    </td>
                    <td className="py-3">
                      <Values values={row.after} empty={t('noValue')} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {cursor ? (
            <Button
              type="button"
              variant="secondary"
              className="self-start"
              disabled={loadingMore}
              onClick={() => void more()}
            >
              {t('more')}
            </Button>
          ) : null}
        </>
      )}
    </div>
  );
}
