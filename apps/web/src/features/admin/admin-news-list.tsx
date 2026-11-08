'use client';

import type { AdminClient } from '@vcraft/api-client';
import type { AdminNewsDto, ListAdminNewsQuery } from '@vcraft/contracts';
import { NEWS_ORIGINS } from '@vcraft/domain';
import { Badge, Button, buttonVariants, Card } from '@vcraft/ui';
import { useFormatter, useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { EmptyState } from '@/components/states/empty-state';
import { ErrorState } from '@/components/states/error-state';
import { ListSkeleton } from '@/components/states/skeletons';
import { Link } from '@/i18n/navigation';
import { notify } from '@/lib/notify';
import { useAdminClient } from './admin-dashboard';

const STATES = ['DRAFT', 'SCHEDULED', 'PUBLISHED'] as const;

/** News list for administrators (FR-NEWS-01): drafts, scheduled and published items. */
export function AdminNewsList({ client: provided }: { client?: AdminClient }) {
  const t = useTranslations('admin.news');
  const categories = useTranslations('indexPages.news.categories');
  const format = useFormatter();
  const { client, loading } = useAdminClient(provided);
  const [state, setState] = useState<ListAdminNewsQuery['state']>();
  const [origin, setOrigin] = useState<ListAdminNewsQuery['origin']>();
  const [rows, setRows] = useState<readonly AdminNewsDto[] | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [deleting, setDeleting] = useState<AdminNewsDto | null>(null);
  const [deleteFailed, setDeleteFailed] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!client) return;
    setFailed(false);
    try {
      const page = await client.listNews({
        ...(state ? { state } : {}),
        ...(origin ? { origin } : {}),
      });
      setRows(page.data);
      setCursor(page.nextCursor);
    } catch {
      setFailed(true);
    }
  }, [client, state, origin]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!loading && !client) return <p>{t('signIn')}</p>;

  const more = async () => {
    if (!client || !cursor || busy) return;
    setBusy(true);
    try {
      const page = await client.listNews({
        ...(state ? { state } : {}),
        ...(origin ? { origin } : {}),
        cursor,
      });
      setRows((current) => [...(current ?? []), ...page.data]);
      setCursor(page.nextCursor);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = async () => {
    if (!client || !deleting) return;
    setBusy(true);
    setDeleteFailed(false);
    try {
      await client.deleteNews(deleting.id, deleting.version);
      setDeleting(null);
      await load();
      notify.success(t('deletedToast'));
    } catch {
      setDeleteFailed(true);
    } finally {
      setBusy(false);
    }
  };

  const dateLabel = (row: AdminNewsDto) => {
    if (!row.publishedAt) return null;
    const date = format.dateTime(new Date(row.publishedAt), {
      dateStyle: 'short',
      timeStyle: 'short',
    });
    return row.state === 'SCHEDULED' ? t('scheduledAt', { date }) : t('publishedAt', { date });
  };

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="text-h2">{t('title')}</h1>
          <p className="text-ash">{t('lead')}</p>
        </div>
        <Link href="/admin/tin-tuc/moi" className={buttonVariants()}>
          {t('new')}
        </Link>
      </header>
      <label className="flex max-w-xs flex-col gap-1 text-small">
        {t('stateFilter')}
        <select
          value={state ?? ''}
          onChange={(event) =>
            setState((event.target.value || undefined) as ListAdminNewsQuery['state'])
          }
          className="rounded-input border border-ink/20 bg-surface px-2 py-1.5"
        >
          <option value="">{t('allStates')}</option>
          {STATES.map((value) => (
            <option key={value} value={value}>
              {t(`state.${value}`)}
            </option>
          ))}
        </select>
      </label>
      <label className="flex max-w-xs flex-col gap-1 text-small">
        {t('originFilter')}
        <select
          value={origin ?? ''}
          onChange={(event) =>
            setOrigin((event.target.value || undefined) as ListAdminNewsQuery['origin'])
          }
          className="rounded-input border border-ink/20 bg-surface px-2 py-1.5"
        >
          <option value="">{t('allOrigins')}</option>
          {NEWS_ORIGINS.map((value) => (
            <option key={value} value={value}>
              {t(`origin.${value}`)}
            </option>
          ))}
        </select>
      </label>
      {failed ? (
        <ErrorState message={t('failed')} onRetry={() => void load()} />
      ) : rows === null ? (
        <ListSkeleton label={t('loading')} className="" rows={3} withHeader={false} />
      ) : rows.length === 0 ? (
        <EmptyState
          illustration="scroll"
          title={t('empty')}
          description={t('emptyHint')}
          action={
            state ? (
              <Button type="button" variant="secondary" onClick={() => setState(undefined)}>
                {t('allStates')}
              </Button>
            ) : (
              <Link href="/admin/tin-tuc/moi" className={buttonVariants()}>
                {t('new')}
              </Link>
            )
          }
        />
      ) : (
        <ul className="flex flex-col gap-3" data-testid="admin-news">
          {rows.map((row) => (
            <li key={row.id}>
              <Card className="flex flex-wrap items-center justify-between gap-4 p-4">
                <div className="flex min-w-0 flex-1 basis-64 flex-col gap-2">
                  <p className="font-medium break-words">{row.title}</p>
                  <p className="flex flex-wrap items-center gap-2 text-small text-ash">
                    <Badge tone={row.state === 'PUBLISHED' ? 'clay' : 'outline'}>
                      {t(`state.${row.state}`)}
                    </Badge>
                    <Badge tone="outline">{t(`visibility.${row.visibility}`)}</Badge>
                    <span>{categories(row.category)}</span>
                    {row.pinned ? <Badge tone="seal">{t('pinned')}</Badge> : null}
                    {row.important ? <Badge tone="lacquer">{t('important')}</Badge> : null}
                    {row.origin !== 'MANUAL' ? (
                      <Badge tone="outline">{t(`origin.${row.origin}`)}</Badge>
                    ) : null}
                    {dateLabel(row) ? <span>{dateLabel(row)}</span> : null}
                  </p>
                </div>
                <div className="flex items-center gap-3 text-small">
                  <Link
                    href={{ pathname: '/admin/tin-tuc/[id]', params: { id: row.id } }}
                    className="font-medium text-clay hover:underline"
                  >
                    {t('edit')}
                  </Link>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      setDeleteFailed(false);
                      setDeleting(row);
                    }}
                  >
                    {t('delete')}
                  </Button>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
      {cursor && !failed ? (
        <Button
          type="button"
          variant="secondary"
          className="self-start"
          disabled={busy}
          onClick={() => void more()}
        >
          {t('more')}
        </Button>
      ) : null}
      <ConfirmDialog
        open={deleting !== null}
        tone="seal"
        title={t('deleteTitle')}
        confirmLabel={t('delete')}
        cancelLabel={t('keep')}
        confirmDisabled={busy}
        onClose={() => setDeleting(null)}
        onConfirm={() => void confirmDelete()}
      >
        <p className="text-ink/85">{t('deleteText', { title: deleting?.title ?? '' })}</p>
        {deleteFailed ? (
          <p role="alert" className="text-small text-seal">
            {t('deleteFailed')}
          </p>
        ) : null}
      </ConfirmDialog>
    </div>
  );
}
