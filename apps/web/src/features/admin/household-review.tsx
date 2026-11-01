'use client';

import { type AdminClient, ApiError, type HouseholdAction } from '@vcraft/api-client';
import type { HouseholdDocumentDto, HouseholdDto } from '@vcraft/contracts';
import { Badge, Button, buttonVariants, Card, SealMark } from '@vcraft/ui';
import dynamic from 'next/dynamic';
import { useFormatter, useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';
import { Breadcrumbs } from '@/components/breadcrumbs';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { EmptyState } from '@/components/states/empty-state';
import { ErrorState } from '@/components/states/error-state';
import { DashboardSkeleton } from '@/components/states/skeletons';
import { Link } from '@/i18n/navigation';
import { useUntabbable } from '@/lib/a11y/use-untabbable';
import { notify } from '@/lib/notify';
import { useAdminClient } from './admin-dashboard';

const WorkshopReviewMap = dynamic(() => import('./workshop-review-map'), {
  ssr: false,
  loading: () => <div className="size-full animate-pulse bg-paper" />,
});

/** Hành động theo trạng thái; `needsReason` khớp luật bắt buộc lý do của domain. */
const ACTIONS: Record<
  HouseholdDto['status'],
  readonly { action: HouseholdAction; needsReason: boolean }[]
> = {
  PENDING_REVIEW: [
    { action: 'approve', needsReason: false },
    { action: 'request-info', needsReason: true },
    { action: 'reject', needsReason: true },
  ],
  APPROVED: [{ action: 'suspend', needsReason: true }],
  SUSPENDED: [{ action: 'reinstate', needsReason: false }],
  REJECTED: [],
};

function DocumentRow({ doc, client }: { doc: HouseholdDocumentDto; client: AdminClient }) {
  const t = useTranslations('admin.review');
  const [failed, setFailed] = useState(false);
  const open = async () => {
    setFailed(false);
    // Mở tab trước khi chờ mạng, để trình duyệt không coi là cửa sổ bật lên ngoài ý muốn.
    const tab = window.open('', '_blank', 'noopener=no');
    try {
      const { url } = await client.documentUrl(doc.id);
      if (tab) tab.location.href = url;
      else window.location.assign(url);
    } catch {
      tab?.close();
      setFailed(true);
    }
  };
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 border-ink/10 border-b py-2 last:border-b-0">
      <span className="text-small">{doc.mimeType}</span>
      <Button type="button" variant="secondary" size="sm" onClick={() => void open()}>
        {t('openDocument')}
      </Button>
      {failed ? (
        <p role="alert" className="w-full text-small text-seal">
          {t('documentFailed')}
        </p>
      ) : null}
    </li>
  );
}

/**
 * Duyệt một hộ (FR-ADM-02 … 04): thông tin khai ↔ giấy tờ (URL ký 5 phút, chỉ Admin) ↔ xưởng trên
 * bản đồ, cùng các quyết định: duyệt có hiệu ứng đóng ấn, từ chối và yêu cầu bổ sung phải có lý do,
 * khóa và mở khóa hộ.
 */
export function HouseholdReview({
  householdId,
  client: provided,
}: {
  householdId: string;
  client?: AdminClient;
}) {
  const t = useTranslations('admin.review');
  const nav = useTranslations('admin.nav');
  const statuses = useTranslations('studio.home.statuses');
  const format = useFormatter();
  const { client, loading } = useAdminClient(provided);
  const [household, setHousehold] = useState<HouseholdDto | null>(null);
  const [documents, setDocuments] = useState<readonly HouseholdDocumentDto[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'missing' | 'failed'>('loading');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<HouseholdAction | null>(null);
  const [result, setResult] = useState<'sealed' | 'done' | 'stale' | 'failed' | null>(null);
  // The review map is decorative (the workshop list below has the same facts); keep it out of the tab order.
  const map = useUntabbable<HTMLDivElement>(household);

  const load = useCallback(async () => {
    if (!client) return;
    try {
      const [next, docs] = await Promise.all([
        client.getHousehold(householdId),
        client.documents(householdId),
      ]);
      setHousehold(next);
      setDocuments(docs.data);
      setState('ready');
    } catch (error) {
      setState(error instanceof ApiError && error.status === 404 ? 'missing' : 'failed');
    }
  }, [client, householdId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!loading && !client) return <p>{t('signIn')}</p>;
  if (state === 'missing') {
    return (
      <EmptyState
        illustration="magnifier"
        title={t('missing')}
        action={
          <Link href="/admin/duyet-ho" className={buttonVariants({ variant: 'secondary' })}>
            {t('back')}
          </Link>
        }
      />
    );
  }
  if (state === 'failed') {
    return <ErrorState message={t('failed')} onRetry={() => void load()} />;
  }
  if (!household || !client) return <DashboardSkeleton label={t('loading')} className="" />;

  const decide = async (action: HouseholdAction) => {
    setBusy(true);
    setResult(null);
    try {
      setHousehold(await client.decide(household.id, action, household.version, reason.trim()));
      setReason('');
      setResult(action === 'approve' ? 'sealed' : 'done');
      notify.success(t(action === 'approve' ? 'sealed' : 'saved'));
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        await load();
        setResult('stale');
      } else {
        setResult('failed');
      }
    } finally {
      setBusy(false);
    }
  };

  const actions = ACTIONS[household.status];
  const reasonOk = reason.trim().length >= 3;

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumbs
        items={[
          { label: nav('overview'), href: '/admin' },
          { label: nav('queue'), href: '/admin/duyet-ho' },
          { label: household.name },
        ]}
      />
      <header className="flex flex-wrap items-center gap-3">
        <h1 className="text-h2">{household.name}</h1>
        <Badge tone={household.status === 'PENDING_REVIEW' ? 'lacquer' : 'outline'}>
          {statuses(household.status)}
        </Badge>
        {result === 'sealed' ? (
          <SealMark size={64} className="animate-stamp" title={t('sealed')} />
        ) : null}
      </header>
      {household.statusReason ? (
        <p className="text-small text-ash">
          {t('currentReason', { reason: household.statusReason })}
        </p>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-3" data-testid="review-columns">
        <Card className="flex flex-col gap-3 p-5">
          <h2 className="text-h3">{t('declared')}</h2>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-small">
            <dt className="text-ash">{t('craft')}</dt>
            <dd>{household.craft ?? '—'}</dd>
            <dt className="text-ash">{t('village')}</dt>
            <dd>{household.village ?? '—'}</dd>
            <dt className="text-ash">{t('foundedYear')}</dt>
            <dd>{household.foundedYear ?? '—'}</dd>
            <dt className="text-ash">{t('artisans')}</dt>
            <dd>{household.artisans.map((a) => a.name).join(', ') || '—'}</dd>
            {household.approvedAt ? (
              <>
                <dt className="text-ash">{t('approvedAt')}</dt>
                <dd>{format.dateTime(new Date(household.approvedAt), 'short')}</dd>
              </>
            ) : null}
          </dl>
          <p className="whitespace-pre-line text-small">{household.history}</p>
        </Card>

        <Card className="flex flex-col gap-3 p-5">
          <h2 className="text-h3">{t('documents')}</h2>
          <p className="text-small text-ash">{t('documentsHint')}</p>
          {documents.length === 0 ? (
            <p className="text-small text-ash">{t('noDocuments')}</p>
          ) : (
            <ul data-testid="review-documents">
              {documents.map((doc) => (
                <DocumentRow key={doc.id} doc={doc} client={client} />
              ))}
            </ul>
          )}
        </Card>

        <Card className="flex flex-col gap-3 p-5">
          <h2 className="text-h3">{t('workshops')}</h2>
          {household.workshops.some((w) => w.lat !== null) ? (
            <div ref={map} aria-hidden="true" className="h-56 overflow-hidden rounded-input">
              <WorkshopReviewMap workshops={household.workshops} />
            </div>
          ) : null}
          {household.workshops.length === 0 ? (
            <p className="text-small text-ash">{t('noWorkshops')}</p>
          ) : (
            <ul className="flex flex-col gap-1 text-small">
              {household.workshops.map((w) => (
                <li key={w.id}>
                  <span className="font-medium">{w.name}</span> · {w.address}
                  {w.lat !== null && w.lng !== null ? (
                    <span className="block font-mono text-[0.75rem] text-ash">
                      {w.lat}, {w.lng}
                    </span>
                  ) : (
                    <span className="block text-seal">{t('noLocation')}</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {actions.length > 0 ? (
        <Card className="flex flex-col gap-4 p-5">
          <h2 className="text-h3">{t('decision')}</h2>
          {actions.some((a) => a.needsReason) ? (
            <label className="flex flex-col gap-1 text-small">
              {t('reason')}
              <textarea
                rows={2}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                className="rounded-input border border-ink/20 bg-surface px-3 py-2"
              />
            </label>
          ) : null}
          <div className="flex flex-wrap gap-3">
            {actions.map(({ action, needsReason }) => (
              <Button
                key={action}
                type="button"
                variant={needsReason ? 'secondary' : 'primary'}
                disabled={busy || (needsReason && !reasonOk)}
                onClick={() => setPending(action)}
              >
                {t(`actions.${action}`)}
              </Button>
            ))}
          </div>
        </Card>
      ) : null}
      <ConfirmDialog
        open={pending !== null}
        tone={pending === 'reject' || pending === 'suspend' ? 'seal' : 'primary'}
        title={pending ? t(`confirm.${pending}.title`) : ''}
        confirmLabel={pending ? t(`actions.${pending}`) : ''}
        cancelLabel={t('back')}
        confirmDisabled={busy}
        onClose={() => setPending(null)}
        onConfirm={() => {
          const action = pending;
          setPending(null);
          if (action) void decide(action);
        }}
      >
        {pending ? (
          <p className="text-ash">{t(`confirm.${pending}.text`, { name: household.name })}</p>
        ) : null}
        {pending && reason.trim() ? (
          <p className="text-small">{t('currentReason', { reason: reason.trim() })}</p>
        ) : null}
      </ConfirmDialog>
      {result === 'stale' || result === 'failed' ? (
        <p role="alert" className="text-small text-seal">
          {t(result === 'stale' ? 'stale' : 'failed_action')}
        </p>
      ) : null}
    </div>
  );
}
