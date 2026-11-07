'use client';

import { ApiError, type StudioClient } from '@vcraft/api-client';
import type { HouseholdDto, ProductDto, UpdateProductRequest } from '@vcraft/contracts';
import { PRIVACY_POLICY_VERSION } from '@vcraft/domain';
import {
  Badge,
  Button,
  buttonVariants,
  Card,
  cn,
  SealStamp,
  stampShakeClass,
  TraceSealFrame,
} from '@vcraft/ui';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Breadcrumbs } from '@/components/breadcrumbs';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { ConsentCheckbox } from '@/components/consent-checkbox';
import { EmptyState } from '@/components/states/empty-state';
import { TraceQr } from '@/features/traceability/trace-qr';
import { Link } from '@/i18n/navigation';
import { notify } from '@/lib/notify';
import { traceShortUrl } from '@/lib/site';
import { HouseholdGate } from './household-gate';
import { type ProductDraft, ProductFields, toProductDraft } from './product-fields';
import { ProductPhotos } from './product-photos';
import { QrLabelsButton } from './qr-labels-button';
import { inputClass } from './workshop-editor';

export function toProductUpdate(draft: ProductDraft): UpdateProductRequest {
  return {
    name: draft.name.trim(),
    description: draft.description.trim(),
    category: draft.category,
    priceVnd: Number(draft.priceVnd || 0),
    stock: Number(draft.stock || 0),
    material: draft.material.trim(),
    dimensions: draft.dimensions.trim(),
    weightGrams: draft.weightGrams ? Number(draft.weightGrams) : null,
    artisanNote: draft.artisanNote.trim(),
  };
}

interface SectionProps {
  product: ProductDto;
  household: HouseholdDto;
  client: StudioClient;
  reload: () => Promise<void>;
}

function DetailsSection({ product, client, reload }: SectionProps) {
  const t = useTranslations('studio.products');
  const common = useTranslations('studio');
  const [draft, setDraft] = useState(() => toProductDraft(product));
  const [state, setState] = useState<'idle' | 'saving' | 'stale' | 'failed'>('idle');
  const save = async () => {
    setState('saving');
    try {
      await client.updateProduct(product.id, product.version, toProductUpdate(draft));
      await reload();
      setState('idle');
      notify.success(common('saved'));
    } catch (error) {
      const stale = error instanceof ApiError && error.status === 409;
      if (stale) await reload();
      setState(stale ? 'stale' : 'failed');
    }
  };
  return (
    <Card className="flex flex-col gap-4 p-5">
      <h2 className="text-h3">{t('details')}</h2>
      <ProductFields
        draft={draft}
        kindLocked
        onChange={(change) => setDraft({ ...draft, ...change })}
      />
      <div className="flex items-center gap-3">
        <Button type="button" disabled={state === 'saving'} onClick={() => void save()}>
          {common('save')}
        </Button>
        {state === 'stale' || state === 'failed' ? (
          <p role="alert" className="text-small text-seal">
            {common(state === 'stale' ? 'stale' : 'saveFailed')}
          </p>
        ) : null}
      </div>
    </Card>
  );
}

function MakersSection({ product, household, client, reload }: SectionProps) {
  const t = useTranslations('studio.products');
  const common = useTranslations('studio');
  const [parts, setParts] = useState<Record<string, string>>(() =>
    Object.fromEntries(product.makers.map((m) => [m.artisanId, m.contribution])),
  );
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  // Adding a person publishes their name on the household page, so the household confirms they agree.
  const [artisanConsent, setArtisanConsent] = useState(false);
  const [state, setState] = useState<'idle' | 'failed'>('idle');
  const save = async () => {
    try {
      await client.setMakers(product.id, {
        makers: household.artisans.flatMap((a) => {
          const contribution = parts[a.id]?.trim();
          return contribution ? [{ artisanId: a.id, contribution }] : [];
        }),
      });
      await reload();
      setState('idle');
      notify.success(common('saved'));
    } catch {
      setState('failed');
    }
  };
  const addArtisan = async () => {
    try {
      await client.recordConsent('MAKER_PROFILE', PRIVACY_POLICY_VERSION);
      await client.addArtisan({ name, ...(role.trim() ? { craftRole: role.trim() } : {}) });
      setName('');
      setRole('');
      setArtisanConsent(false);
      await reload();
      setState('idle');
      notify.success(t('artisanAdded'));
    } catch {
      setState('failed');
    }
  };
  return (
    <Card className="flex flex-col gap-4 p-5">
      <h2 className="text-h3">{t('makers')}</h2>
      <p className="text-small text-ash">{t('makersHint')}</p>
      {household.artisans.length === 0 ? (
        <p className="text-small text-ash">{t('noArtisans')}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {household.artisans.map((artisan) => (
            <li key={artisan.id}>
              <label className="flex flex-col gap-1 text-small">
                {t('contribution', { name: artisan.name })}
                <input
                  value={parts[artisan.id] ?? ''}
                  onChange={(event) => setParts({ ...parts, [artisan.id]: event.target.value })}
                  className={inputClass}
                />
              </label>
            </li>
          ))}
        </ul>
      )}
      <div className="flex items-center gap-3">
        <Button
          type="button"
          disabled={!Object.values(parts).some((part) => part.trim().length >= 2)}
          onClick={() => void save()}
        >
          {common('save')}
        </Button>
        {state === 'failed' ? (
          <p role="alert" className="text-small text-seal">
            {common('saveFailed')}
          </p>
        ) : null}
      </div>
      <div className="flex flex-wrap items-end gap-3 border-ink/10 border-t pt-4">
        <label className="flex flex-col gap-1 text-small">
          {t('newArtisan')}
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            className={inputClass}
          />
        </label>
        <label className="flex flex-col gap-1 text-small">
          {t('newArtisanRole')}
          <input
            value={role}
            onChange={(event) => setRole(event.target.value)}
            className={inputClass}
          />
        </label>
        <Button
          type="button"
          variant="secondary"
          disabled={name.trim().length < 2 || !artisanConsent}
          onClick={() => void addArtisan()}
        >
          {t('addArtisan')}
        </Button>
      </div>
      <ConsentCheckbox
        id="artisan-consent"
        purpose="artisan"
        checked={artisanConsent}
        onChange={(event) => setArtisanConsent(event.target.checked)}
      />
    </Card>
  );
}

function PublishSection({ product, household, client, reload }: SectionProps) {
  const t = useTranslations('studio.products');
  const common = useTranslations('studio');
  const [reason, setReason] = useState('');
  const [failed, setFailed] = useState<'generic' | 'journal-required' | null>(null);
  const [confirm, setConfirm] = useState<'publish' | 'withdraw' | null>(null);
  // BRAND §6.3 #2: publishing presses the seal once, right after it succeeds.
  const [stamped, setStamped] = useState(false);
  const run = async (action: () => Promise<unknown>, success: string, stamp = false) => {
    setFailed(null);
    setStamped(false);
    try {
      await action();
      await reload();
      setReason('');
      setStamped(stamp);
      notify.success(success);
    } catch (error) {
      setFailed(
        error instanceof ApiError && error.code === 'PRODUCT_JOURNAL_REQUIRED'
          ? 'journal-required'
          : 'generic',
      );
    }
  };
  const approved = household.status === 'APPROVED';
  return (
    <Card
      className={cn(
        'flex flex-col gap-4 p-5',
        stamped && product.status === 'PUBLISHED' && stampShakeClass('tool'),
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-h3">{t('publishing')}</h2>
        <span className="flex items-center gap-3">
          {stamped && product.status === 'PUBLISHED' ? (
            <SealStamp size={40} tempo="tool" title={t('publishedToast')} />
          ) : null}
          <Badge tone={product.status === 'PUBLISHED' ? 'lacquer' : 'outline'}>
            {t(`statuses.${product.status}`)}
          </Badge>
        </span>
      </div>
      {product.status === 'PUBLISHED' ? (
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex grow flex-col gap-1 text-small">
            {t('withdrawReason')}
            <input
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              className={inputClass}
            />
          </label>
          <Button
            type="button"
            variant="secondary"
            disabled={reason.trim().length < 3}
            onClick={() => setConfirm('withdraw')}
          >
            {t('withdraw')}
          </Button>
        </div>
      ) : (
        <div>
          <Button type="button" disabled={!approved} onClick={() => setConfirm('publish')}>
            {product.status === 'WITHDRAWN' ? t('republish') : t('publish')}
          </Button>
          {!approved ? <p className="mt-2 text-small text-ash">{t('notApproved')}</p> : null}
        </div>
      )}
      {failed ? (
        <p role="alert" className="text-small text-seal">
          {t(failed === 'journal-required' ? 'publishJournalRequired' : 'publishFailed')}
        </p>
      ) : null}
      <ConfirmDialog
        open={confirm === 'publish'}
        title={t('publishTitle')}
        confirmLabel={product.status === 'WITHDRAWN' ? t('republish') : t('publish')}
        cancelLabel={common('cancel')}
        onClose={() => setConfirm(null)}
        onConfirm={() => {
          setConfirm(null);
          void run(
            () =>
              client.publishProduct(product.id, product.version, product.status === 'WITHDRAWN'),
            t('publishedToast'),
            true,
          );
        }}
      >
        <p className="text-ash">{t('publishText')}</p>
      </ConfirmDialog>
      <ConfirmDialog
        open={confirm === 'withdraw'}
        tone="seal"
        title={t('withdrawTitle')}
        confirmLabel={t('withdraw')}
        cancelLabel={common('cancel')}
        onClose={() => setConfirm(null)}
        onConfirm={() => {
          setConfirm(null);
          void run(
            () => client.withdrawProduct(product.id, product.version, reason.trim()),
            t('withdrawnToast'),
          );
        }}
      >
        <p className="text-ash">{t('withdrawText', { reason: reason.trim() })}</p>
      </ConfirmDialog>
    </Card>
  );
}

/** Tải mã QR PNG cỡ in (FR-TRC-02); thư viện vẽ QR chỉ nạp khi bấm. */
async function downloadQrPng(url: string, code: string) {
  const { default: QRCodeStyling } = await import('qr-code-styling');
  const qr = new QRCodeStyling({
    width: 1024,
    height: 1024,
    type: 'canvas',
    data: url,
    margin: 32,
    qrOptions: { errorCorrectionLevel: 'H' },
    dotsOptions: { type: 'rounded', color: '#1c1814' },
    cornersSquareOptions: { type: 'extra-rounded', color: '#c2261f' },
    cornersDotOptions: { color: '#c2261f' },
    backgroundOptions: { color: '#ffffff' },
  });
  await qr.download({ name: `vcraft-qr-${code}`, extension: 'png' });
}

function QrSection({ product, client }: { product: ProductDto; client: StudioClient }) {
  const t = useTranslations('studio.products');
  const url = traceShortUrl(product.traceCode);
  return (
    <Card className="flex flex-col items-start gap-4 p-5 md:flex-row md:items-center">
      <TraceSealFrame code={product.traceCode} size={160} title={t('qr')}>
        <TraceQr url={url} size={108} />
      </TraceSealFrame>
      <div className="flex flex-col items-start gap-2">
        <h2 className="text-h3">{t('qr')}</h2>
        <p className="text-small text-ash">{t('qrLead')}</p>
        <p className="font-mono text-small">{url.replace(/^https?:\/\//, '')}</p>
        <div className="flex flex-wrap items-start gap-3">
          <Button
            type="button"
            variant="secondary"
            onClick={() => void downloadQrPng(url, product.traceCode)}
          >
            {t('qrDownload')}
          </Button>
          <QrLabelsButton
            client={client}
            productIds={[product.id]}
            // One label for a single piece; a batch gets one per piece, up to a full sheet.
            copies={product.kind === 'BATCH' ? Math.min(product.batchSize ?? 45, 45) : 1}
            label={t('labels.oneSheet')}
          />
        </div>
      </div>
    </Card>
  );
}

/** Màn sửa một sản phẩm: thông tin, ảnh, người làm, xuất bản, mã QR và lối vào nhật ký. */
export function ProductEditor({ productId, client }: { productId: string; client?: StudioClient }) {
  const t = useTranslations('studio.products');
  const nav = useTranslations('studio.nav');
  return (
    <HouseholdGate client={client}>
      {({ household, client: live, reload }) => {
        const product = household.products.find((p) => p.id === productId);
        if (!product)
          return (
            <EmptyState
              className="py-section"
              illustration="vase"
              title={t('notFound')}
              action={
                <Link href="/studio/san-pham" className={buttonVariants({ variant: 'secondary' })}>
                  {t('title')}
                </Link>
              }
            />
          );
        const props = { product, household, client: live, reload };
        return (
          <div className="mx-auto flex max-w-editorial flex-col gap-6 px-gutter py-8 pb-24 md:pb-12">
            <Breadcrumbs
              items={[
                { label: nav('home'), href: '/studio' },
                { label: t('title'), href: '/studio/san-pham' },
                { label: product.name },
              ]}
            />
            <header className="flex flex-wrap items-center justify-between gap-4">
              <h1 className="text-h1">{product.name}</h1>
              <Link
                href={{ pathname: '/studio/san-pham/[id]/nhat-ky', params: { id: product.id } }}
                className={buttonVariants({ variant: 'secondary' })}
              >
                {t('journalLink')}
              </Link>
            </header>
            <PublishSection {...props} />
            <DetailsSection {...props} />
            <ProductPhotos product={product} client={live} onSaved={reload} />
            <MakersSection {...props} />
            <QrSection product={product} client={live} />
          </div>
        );
      }}
    </HouseholdGate>
  );
}
