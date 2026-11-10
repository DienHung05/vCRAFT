'use client';

import { type AdminClient, ApiError, type HouseholdAction } from '@vcraft/api-client';
import type { HouseholdDocumentDto, HouseholdDto, ProductDto } from '@vcraft/contracts';
import { isInBatTrang } from '@vcraft/domain';
import { Badge, Button, buttonVariants, Card, cn, SealStamp, stampShakeClass } from '@vcraft/ui';
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
  // The board never sees a draft; it has no decisions.
  DRAFT: [],
};

/** Citizen ID number: masked until an admin asks to see it; each reveal is audited server-side. */
function IdNumberRow({ household, client }: { household: HouseholdDto; client: AdminClient }) {
  const t = useTranslations('admin.review');
  const [shown, setShown] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const reveal = async () => {
    setFailed(false);
    try {
      const { idNumber } = await client.revealIdNumber(household.id);
      setShown(idNumber);
    } catch {
      setFailed(true);
    }
  };
  return (
    <>
      <dt className="text-ash">{t('idNumber')}</dt>
      <dd className="flex flex-wrap items-center gap-2">
        {shown ? (
          <>
            <span className="font-mono" data-testid="revealed-id-number">
              {shown}
            </span>
            <Button type="button" variant="ghost" size="sm" onClick={() => setShown(null)}>
              {t('hideIdNumber')}
            </Button>
          </>
        ) : household.idNumberMasked ? (
          <>
            <span className="font-mono">{household.idNumberMasked}</span>
            <Button type="button" variant="secondary" size="sm" onClick={() => void reveal()}>
              {t('revealIdNumber')}
            </Button>
          </>
        ) : (
          <span className="text-ash">{t('noIdNumber')}</span>
        )}
        {failed ? (
          <span role="alert" className="w-full text-seal">
            {t('idNumberFailed')}
          </span>
        ) : null}
        {household.idNumberMasked ? (
          <span className="w-full text-ash text-xs">{t('revealAudited')}</span>
        ) : null}
      </dd>
    </>
  );
}

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
      <span
        className="min-w-0 flex-1 basis-48 truncate text-small"
        title={doc.caption ?? undefined}
      >
        {doc.caption ?? doc.mimeType}
      </span>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        aria-label={t('openNamed', { name: doc.caption ?? doc.mimeType })}
        onClick={() => void open()}
      >
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

/** Review groups in a fixed order; legacy uploads without a classification come last (vCRAFT-8my.3). */
const DOCUMENT_KIND_ORDER = ['IDENTITY', 'RESIDENCE', 'WORKSHOP', 'UNKNOWN'] as const;

/** Group identity, residence and workshop evidence, with unclassified legacy files last. */
function DocumentGroups({
  documents,
  client,
}: {
  documents: readonly HouseholdDocumentDto[];
  client: AdminClient;
}) {
  const t = useTranslations('admin.review');
  const groups = DOCUMENT_KIND_ORDER.map((kind) => ({
    kind,
    docs: documents.filter((doc) => (doc.certificateKind ?? 'UNKNOWN') === kind),
  })).filter((group) => group.docs.length > 0);
  return (
    <div className="flex flex-col gap-4" data-testid="review-documents">
      {groups.map((group) => (
        <section key={group.kind} className="flex min-w-0 flex-col gap-1">
          <h3 className="text-small font-semibold">
            {t(`documentKind.${group.kind}`)}{' '}
            <span className="font-normal text-ash">({group.docs.length})</span>
          </h3>
          <ul>
            {group.docs.map((doc) => (
              <DocumentRow key={doc.id} doc={doc} client={client} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

/** The household's products with the board's moderation: withdraw (with a reason) and republish. */
function ProductsCard({
  products,
  client,
  onChanged,
  onStale,
}: {
  products: readonly ProductDto[];
  client: AdminClient;
  onChanged: (product: ProductDto) => void;
  onStale: () => Promise<void>;
}) {
  const t = useTranslations('admin.review');
  const statuses = useTranslations('studio.products.statuses');
  const [pending, setPending] = useState<{
    product: ProductDto;
    action: 'withdraw' | 'republish';
  } | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<'stale' | 'failed' | null>(null);

  const run = async () => {
    if (!pending) return;
    const { product, action } = pending;
    setPending(null);
    setBusy(true);
    setResult(null);
    try {
      const next =
        action === 'withdraw'
          ? await client.withdrawProduct(product.id, product.version, reason.trim())
          : await client.republishProduct(product.id, product.version);
      onChanged(next);
      setReason('');
      notify.success(t(action === 'withdraw' ? 'productWithdrawn' : 'productRepublished'));
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        await onStale();
        setResult('stale');
      } else {
        setResult('failed');
      }
    } finally {
      setBusy(false);
    }
  };

  const close = () => {
    setPending(null);
    setReason('');
  };

  return (
    <Card className="flex min-w-0 flex-col gap-3 p-5" data-testid="review-products">
      <h2 className="text-h3">{t('products')}</h2>
      <p className="text-small text-ash">{t('productsHint')}</p>
      {products.length === 0 ? (
        <p className="text-small text-ash">{t('noProducts')}</p>
      ) : (
        <ul className="flex flex-col">
          {products.map((product) => {
            const canWithdraw = product.status === 'PUBLISHED' || product.status === 'SOLD';
            const canRepublish = product.status === 'WITHDRAWN' && product.withdrawnBy === 'BOARD';
            return (
              <li
                key={product.id}
                className="flex flex-wrap items-center justify-between gap-3 border-ink/10 border-b py-3 last:border-b-0"
              >
                <div className="min-w-0 flex-1 basis-56">
                  <p className="break-words font-medium">{product.name}</p>
                  {product.status === 'WITHDRAWN' ? (
                    <p className="text-small text-ash">
                      {product.withdrawnBy
                        ? t(`withdrawnBy.${product.withdrawnBy}`)
                        : t('withdrawnByUnknown')}
                      {product.withdrawnReason
                        ? ` · ${t('withdrawnReason', { reason: product.withdrawnReason })}`
                        : ''}
                    </p>
                  ) : null}
                </div>
                <Badge tone={product.status === 'PUBLISHED' ? 'lacquer' : 'outline'}>
                  {statuses(product.status)}
                </Badge>
                {canWithdraw ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={busy}
                    aria-label={t('withdrawProductNamed', { name: product.name })}
                    onClick={() => setPending({ product, action: 'withdraw' })}
                  >
                    {t('withdrawProduct')}
                  </Button>
                ) : null}
                {canRepublish ? (
                  <Button
                    type="button"
                    size="sm"
                    disabled={busy}
                    aria-label={t('republishProductNamed', { name: product.name })}
                    onClick={() => setPending({ product, action: 'republish' })}
                  >
                    {t('republishProduct')}
                  </Button>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
      {result ? (
        <p role="alert" className="text-small text-seal">
          {t(result === 'stale' ? 'productStale' : 'productFailed')}
        </p>
      ) : null}
      <ConfirmDialog
        open={pending !== null}
        tone={pending?.action === 'withdraw' ? 'seal' : 'primary'}
        title={pending ? t(`productConfirm.${pending.action}.title`) : ''}
        confirmLabel={pending ? t(`productConfirm.${pending.action}.confirm`) : ''}
        cancelLabel={t('back')}
        confirmDisabled={busy || (pending?.action === 'withdraw' && reason.trim().length < 3)}
        onClose={close}
        onConfirm={() => void run()}
      >
        {pending ? (
          <p className="text-ash">
            {t(`productConfirm.${pending.action}.text`, { name: pending.product.name })}
          </p>
        ) : null}
        {pending?.action === 'withdraw' ? (
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
      </ConfirmDialog>
    </Card>
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
  const areas = useTranslations('villageAreas');
  const crafts = useTranslations('catalog.craftCategories');
  const format = useFormatter();
  const { client, loading } = useAdminClient(provided);
  const [household, setHousehold] = useState<HouseholdDto | null>(null);
  const [documents, setDocuments] = useState<readonly HouseholdDocumentDto[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'missing' | 'failed'>('loading');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<HouseholdAction | null>(null);
  const [result, setResult] = useState<
    'sealed' | 'done' | 'stale' | 'failed' | 'incomplete' | null
  >(null);
  // Parts the API reported missing on a 422 APPLICATION_INCOMPLETE (profile, workshops, documents).
  const [missingParts, setMissingParts] = useState<string[]>([]);
  // FR-ART-03: the certification being toggled, and how the last toggle ended.
  const [certBusy, setCertBusy] = useState<number | null>(null);
  const [certResult, setCertResult] = useState<'stale' | 'failed' | null>(null);
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
    setMissingParts([]);
    try {
      setHousehold(await client.decide(household.id, action, household.version, reason.trim()));
      setReason('');
      setResult(action === 'approve' ? 'sealed' : 'done');
      notify.success(t(action === 'approve' ? 'sealed' : 'saved'));
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        await load();
        setResult('stale');
      } else if (error instanceof ApiError && error.code === 'APPLICATION_INCOMPLETE') {
        setMissingParts(error.fieldErrors.map((e) => e.path));
        setResult('incomplete');
      } else {
        setResult('failed');
      }
    } finally {
      setBusy(false);
    }
  };

  const setVerified = async (index: number, verified: boolean) => {
    setCertBusy(index);
    setCertResult(null);
    try {
      setHousehold(
        await client.setCertificationVerified(household.id, index, household.version, verified),
      );
      notify.success(t('certSaved'));
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        await load();
        setCertResult('stale');
      } else {
        setCertResult('failed');
      }
    } finally {
      setCertBusy(null);
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
      <header
        className={cn(
          'flex flex-wrap items-center gap-3',
          result === 'sealed' && stampShakeClass('tool'),
        )}
      >
        <h1 className="text-h2">{household.name}</h1>
        <Badge tone={household.status === 'PENDING_REVIEW' ? 'lacquer' : 'outline'}>
          {statuses(household.status)}
        </Badge>
        {result === 'sealed' ? <SealStamp size={64} tempo="tool" title={t('sealed')} /> : null}
      </header>
      {household.statusReason ? (
        <p className="text-small text-ash">
          {t('currentReason', { reason: household.statusReason })}
        </p>
      ) : null}

      <div className="grid min-w-0 gap-5 xl:grid-cols-3" data-testid="review-columns">
        <Card className="flex min-w-0 flex-col gap-3 p-5">
          <h2 className="text-h3">{t('declared')}</h2>
          <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 text-small">
            <dt className="text-ash">{t('craft')}</dt>
            <dd className="min-w-0 break-words">
              {[household.craftCategory ? crafts(household.craftCategory) : null, household.craft]
                .filter(Boolean)
                .join(' · ') || '—'}
            </dd>
            <dt className="text-ash">{t('village')}</dt>
            <dd className="min-w-0 break-words">{household.village ?? '—'}</dd>
            <dt className="text-ash">{t('foundedYear')}</dt>
            <dd className="min-w-0 break-words">{household.foundedYear ?? '—'}</dd>
            <IdNumberRow household={household} client={client} />
            <dt className="text-ash">{t('artisans')}</dt>
            <dd className="min-w-0 break-words">
              {household.artisans.map((a) => a.name).join(', ') || '—'}
            </dd>
            {household.approvedAt ? (
              <>
                <dt className="text-ash">{t('approvedAt')}</dt>
                <dd className="min-w-0 break-words">
                  {format.dateTime(new Date(household.approvedAt), 'short')}
                </dd>
              </>
            ) : null}
          </dl>
          <p className="whitespace-pre-line text-small">{household.history}</p>
        </Card>

        <Card className="flex min-w-0 flex-col gap-3 p-5">
          <h2 className="text-h3">{t('documents')}</h2>
          <p className="text-small text-ash">{t('documentsHint')}</p>
          {documents.length === 0 ? (
            <p className="text-small text-ash">{t('noDocuments')}</p>
          ) : (
            <DocumentGroups documents={documents} client={client} />
          )}
        </Card>

        <Card className="flex min-w-0 flex-col gap-3 p-5">
          <h2 className="text-h3">{t('workshops')}</h2>
          {household.workshops.some((w) => w.lat !== null) ? (
            <>
              {/* The map is an illustration next to the workshop list below, which carries the same
                  facts; its wrapper is not hidden from assistive tech, and the boundary status of
                  each pin is announced by the list entries (vCRAFT-8my.1 a11y review). */}
              <div
                ref={map}
                role="img"
                aria-label={t('mapLabel', {
                  count: household.workshops.filter((w) => w.lat !== null).length,
                })}
                className="h-56 min-w-0 overflow-hidden rounded-input"
              >
                <WorkshopReviewMap workshops={household.workshops} />
              </div>
              <p className="text-small text-ash">{t('mapHint')}</p>
            </>
          ) : null}
          {household.workshops.length === 0 ? (
            <p className="text-small text-ash">{t('noWorkshops')}</p>
          ) : (
            <ul className="flex min-w-0 flex-col gap-1 text-small">
              {household.workshops.map((w) => (
                <li key={w.id} className="min-w-0">
                  <span className="font-medium">{w.name}</span> ·{' '}
                  <span className="break-words">{w.address}</span>
                  <span className="block text-ash">
                    {w.areaCode
                      ? t('workshopArea', { area: areas(w.areaCode) })
                      : t('noWorkshopArea')}
                  </span>
                  {w.lat !== null && w.lng !== null ? (
                    <>
                      <span className="block font-mono text-[0.75rem] text-ash">
                        {w.lat}, {w.lng}
                      </span>
                      {isInBatTrang({ lat: w.lat, lng: w.lng }) ? (
                        <Badge
                          tone="celadon"
                          className="mt-1 max-w-full whitespace-normal text-left"
                        >
                          {t('insideVillage')}
                        </Badge>
                      ) : (
                        <Badge tone="clay" className="mt-1 max-w-full whitespace-normal text-left">
                          {t('outsideVillage')}
                        </Badge>
                      )}
                    </>
                  ) : (
                    <span className="block text-seal">{t('noLocation')}</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card className="flex min-w-0 flex-col gap-3 p-5" data-testid="review-certifications">
        <h2 className="text-h3">{t('certifications')}</h2>
        <p className="text-small text-ash">{t('certificationsHint')}</p>
        {household.certifications.length === 0 ? (
          <p className="text-small text-ash">{t('noCertifications')}</p>
        ) : (
          <ul className="flex flex-col">
            {household.certifications.map((cert, index) => (
              <li
                // biome-ignore lint/suspicious/noArrayIndexKey: the API addresses a certification by its position.
                key={index}
                className="flex flex-wrap items-center justify-between gap-3 border-ink/10 border-b py-3 last:border-b-0"
              >
                <div className="min-w-0 flex-1 basis-56">
                  <p className="break-words font-medium">{cert.name}</p>
                  <p className="text-small text-ash">
                    {t('certMeta', {
                      issuer: cert.issuer,
                      date: cert.issuedOn
                        ? format.dateTime(new Date(`${cert.issuedOn}T00:00:00Z`), {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            timeZone: 'UTC',
                          })
                        : String(cert.year),
                    })}
                  </p>
                  {cert.photo?.url ? (
                    <a
                      href={cert.photo.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-small text-clay underline"
                    >
                      {t('certPhoto')}
                    </a>
                  ) : null}
                </div>
                <Badge tone={cert.verified ? 'lacquer' : 'outline'}>
                  {cert.verified ? t('certVerified') : t('certUnverified')}
                </Badge>
                <Button
                  type="button"
                  size="sm"
                  variant={cert.verified ? 'secondary' : 'primary'}
                  disabled={certBusy !== null}
                  aria-label={t(cert.verified ? 'removeVerificationNamed' : 'markVerifiedNamed', {
                    name: cert.name,
                  })}
                  onClick={() => void setVerified(index, !cert.verified)}
                >
                  {t(cert.verified ? 'removeVerification' : 'markVerified')}
                </Button>
              </li>
            ))}
          </ul>
        )}
        {certResult ? (
          <p role="alert" className="text-small text-seal">
            {t(certResult === 'stale' ? 'certStale' : 'certFailed')}
          </p>
        ) : null}
      </Card>

      <ProductsCard
        products={household.products ?? []}
        client={client}
        onChanged={(next) =>
          setHousehold({
            ...household,
            products: (household.products ?? []).map((p) => (p.id === next.id ? next : p)),
          })
        }
        onStale={load}
      />

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
      {result === 'incomplete' ? (
        <p role="alert" className="text-small text-seal">
          {t('incomplete', {
            parts: missingParts
              .map((part) =>
                part === 'profile' || part === 'workshops' || part === 'documents'
                  ? t(`incompleteParts.${part}`)
                  : part,
              )
              .join(', '),
          })}
        </p>
      ) : null}
      {result === 'stale' || result === 'failed' ? (
        <p role="alert" className="text-small text-seal">
          {t(result === 'stale' ? 'stale' : 'failed_action')}
        </p>
      ) : null}
    </div>
  );
}
