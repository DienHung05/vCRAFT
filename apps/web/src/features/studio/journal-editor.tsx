'use client';

import type { StudioClient } from '@vcraft/api-client';
import type {
  JournalDto,
  JournalEntryDto,
  MediaAssetResponse,
  ProductDto,
} from '@vcraft/contracts';
import {
  JOURNAL_STAGES,
  type JournalStage,
  skippedStagesFor,
  stageTemplateForCategory,
} from '@vcraft/domain';
import { Badge, Button, buttonVariants, Card } from '@vcraft/ui';
import { useFormatter, useTranslations } from 'next-intl';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Breadcrumbs } from '@/components/breadcrumbs';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { ImageSlot } from '@/components/image-slot';
import { PhotoPicker } from '@/components/photo-picker';
import { EmptyState } from '@/components/states/empty-state';
import { ErrorState } from '@/components/states/error-state';
import { TableSkeleton } from '@/components/states/skeletons';
import { prepareImage, sendMedia } from '@/features/media/prepare-image';
import { useMediaWatch } from '@/features/media/use-media-watch';
import { Link } from '@/i18n/navigation';
import { browserAccessToken } from '@/lib/api/live-session';
import { formatDeclaredDate } from '@/lib/declared-date';
import { notify } from '@/lib/notify';
import { useIdempotentAction } from '@/lib/use-idempotent-action';
import { HouseholdGate } from './household-gate';
import { inputClass } from './workshop-editor';

const OLD_PHOTO_DAYS = 30;
/**
 * A courtesy wait for a fast worker, so a photo that is already `READY` is saved with its URL. It never blocks
 * saving (GH#252): the worker can take minutes, and the journal shows a placeholder until the photo is ready.
 */
const PHOTO_POLL_MS = 1500;
const PHOTO_POLL_ATTEMPTS = 5;

const pad = (value: number) => String(value).padStart(2, '0');

/** Ngày giờ theo đồng hồ của ảnh, đúng như người chụp thấy (EXIF không có múi giờ). */
export function exifFields(date: Date): { date: string; time: string } {
  return {
    date: `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
    time: `${pad(date.getHours())}:${pad(date.getMinutes())}`,
  };
}

export const isOldPhoto = (captured: Date, now: Date): boolean =>
  now.getTime() - captured.getTime() > OLD_PHOTO_DAYS * 24 * 60 * 60 * 1000;

/** Giờ gắn vào đầu ghi chú: mốc nhật ký chỉ lưu ngày, và ngày đã nằm trong chuỗi băm. */
export const noteWithTime = (note: string, time: string): string =>
  time ? `${time} · ${note.trim()}` : note.trim();

/**
 * The photo as a journal entry stores it: the checksum of the original, plus the widest WebP when the photo is
 * already processed. A photo still processing is saved by checksum alone; the API resolves its URL later.
 */
export function journalImageOf(asset: Pick<MediaAssetResponse, 'sha256' | 'variants'>) {
  const variant = asset.variants
    .filter((v) => v.format === 'webp')
    .sort((a, b) => b.width - a.width)[0];
  return variant ? { url: variant.url, sha256: asset.sha256 } : { sha256: asset.sha256 };
}

/** Waits briefly for the worker. Returns the last state seen; throws only when processing failed for good. */
async function waitBriefly(
  client: StudioClient,
  uploaded: MediaAssetResponse,
): Promise<MediaAssetResponse> {
  let asset = uploaded;
  for (let attempt = 0; attempt < PHOTO_POLL_ATTEMPTS; attempt++) {
    if (asset.status === 'READY') return asset;
    if (asset.status === 'FAILED') throw new Error('photo-failed');
    if (attempt > 0) await new Promise((resolve) => setTimeout(resolve, PHOTO_POLL_MS));
    try {
      asset = await client.getMedia(uploaded.id);
    } catch {
      // The photo is saved anyway; a failed check only means we could not wait for it.
      return asset;
    }
  }
  return asset.status === 'FAILED' ? Promise.reject(new Error('photo-failed')) : asset;
}

interface FormProps {
  product: ProductDto;
  client: StudioClient;
  journal: JournalDto;
  stage: JournalStage;
  corrects: JournalEntryDto | null;
  onClose: () => void;
  onSaved: (journal: JournalDto) => void;
}

/** "Thêm mốc" mở camera của điện thoại và điền ngày giờ theo EXIF của ảnh (FR-PRD-04). */
function EntryForm({
  product,
  client,
  journal,
  stage: initial,
  corrects,
  onClose,
  onSaved,
}: FormProps) {
  const t = useTranslations('studio.journal');
  const stages = useTranslations('stages');
  const today = exifFields(new Date());
  const [stage, setStage] = useState<JournalStage>(initial);
  const [date, setDate] = useState(today.date);
  const [time, setTime] = useState('');
  const [note, setNote] = useState('');
  const [skipReason, setSkipReason] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);
  const [exif, setExif] = useState<'none' | 'filled' | 'old'>('none');
  const [status, setStatus] = useState<
    'idle' | 'photo' | 'saving' | 'photo-missing' | 'photo-failed' | 'failed'
  >('idle');
  const [confirming, setConfirming] = useState<'old-photo' | 'seal' | null>(null);
  const submitEntry = useIdempotentAction();
  const uploadedPhoto = useRef<{ file: File; images: ReturnType<typeof journalImageOf>[] } | null>(
    null,
  );
  // A published product's journal only grows: a saved milestone can be corrected, never removed.
  const sealed = product.publishedAt !== null;

  const facts = journal.entries.map((e) => ({ seq: e.seq, stage: e.stage }));
  const needsReason = !corrects && skippedStagesFor(facts, stage).length > 0;

  const onPhoto = async (file: File | undefined) => {
    if (!file) {
      setPhoto(null);
      setExif('none');
      return;
    }
    const prepared = await prepareImage(file, new AbortController().signal);
    setPhoto(prepared.file);
    setStatus('idle');
    setExif('none');
    if (prepared.capturedAt) {
      const fields = exifFields(prepared.capturedAt);
      setDate(fields.date);
      setTime(fields.time);
      setExif(isOldPhoto(prepared.capturedAt, new Date()) ? 'old' : 'filled');
    }
  };

  const save = async () => {
    // FR-PRD-04: every milestone carries a photo; the server refuses one without.
    if (!photo) {
      setStatus('photo-missing');
      return;
    }
    setStatus('photo');
    try {
      if (uploadedPhoto.current?.file !== photo) {
        const getToken = browserAccessToken() ?? (async () => null);
        const uploaded = await sendMedia(
          photo,
          'JOURNAL',
          getToken,
          () => {},
          new AbortController().signal,
        );
        uploadedPhoto.current = {
          file: photo,
          images: [journalImageOf(await waitBriefly(client, uploaded))],
        };
      }
      const { images } = uploadedPhoto.current;
      setStatus('saving');
      const body = {
        stage,
        declaredDate: date,
        note: noteWithTime(note, time),
        images,
        ...(needsReason && skipReason.trim() ? { skipReason: skipReason.trim() } : {}),
        ...(corrects ? { supersedesEntryId: corrects.id } : {}),
      };
      const updated = await submitEntry([product.id, body], (options) =>
        client.appendJournalEntry(product.id, body, options),
      );
      notify.success(t(corrects ? 'correctedToast' : 'savedToast'));
      onSaved(updated);
    } catch (error) {
      setStatus(
        error instanceof Error && error.message === 'photo-failed' ? 'photo-failed' : 'failed',
      );
    }
  };

  /** Asks for the confirmations that apply (stale photo, then sealed journal) before saving. */
  const requestSave = (confirmed?: 'old-photo') => {
    if (!photo) {
      setStatus('photo-missing');
      return;
    }
    if (exif === 'old' && confirmed !== 'old-photo') setConfirming('old-photo');
    else if (sealed) setConfirming('seal');
    else void save();
  };

  return (
    <>
      <Card className="flex flex-col gap-4 p-5" data-testid="journal-form">
        <h2 className="text-h3">
          {corrects ? t('correctionTitle', { n: corrects.seq + 1 }) : t('addStage')}
        </h2>
        <PhotoPicker
          label={t('photo')}
          accept="image/*,.heic,.heif"
          capture="environment"
          file={photo}
          onChange={(file) => void onPhoto(file ?? undefined)}
        />
        {exif === 'filled' ? (
          <p role="status" className="text-small text-glaze">
            {t('exifFilled')}
          </p>
        ) : null}
        {exif === 'old' ? (
          <p role="status" className="text-small text-seal">
            {t('exifOld')}
          </p>
        ) : null}
        <div className="grid gap-4 md:grid-cols-3">
          <label className="flex flex-col gap-1 text-small">
            {t('stage')}
            <select
              value={stage}
              onChange={(event) => setStage(event.target.value as JournalStage)}
              className={inputClass}
            >
              {JOURNAL_STAGES.map((s) => (
                <option key={s} value={s}>
                  {stages(`${s}.name`)}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-small">
            {t('date')}
            <input
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1 text-small">
            {t('time')}
            <input
              type="time"
              value={time}
              onChange={(event) => setTime(event.target.value)}
              className={inputClass}
            />
          </label>
        </div>
        <label className="flex flex-col gap-1 text-small">
          {t('note')}
          <textarea
            rows={3}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            className={inputClass}
          />
        </label>
        {needsReason ? (
          <label className="flex flex-col gap-1 text-small">
            {t('skipReason')}
            <input
              value={skipReason}
              onChange={(event) => setSkipReason(event.target.value)}
              className={inputClass}
            />
          </label>
        ) : null}
        {status === 'photo' ? (
          <p role="status" className="text-small text-ash">
            {t('waitingPhoto')}
          </p>
        ) : null}
        {status === 'photo-missing' ? (
          <p role="alert" className="text-small text-seal">
            {t('photoRequired')}
          </p>
        ) : null}
        {status === 'photo-failed' ? (
          <p role="alert" className="text-small text-seal">
            {t('photoFailed')}
          </p>
        ) : null}
        {status === 'failed' ? (
          <p role="alert" className="text-small text-seal">
            {t('saveFailed')}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-3">
          <Button
            type="button"
            disabled={!note.trim() || status === 'photo' || status === 'saving'}
            onClick={() => requestSave()}
          >
            {t('save')}
          </Button>
          <Button type="button" variant="ghost" onClick={onClose}>
            {t('cancel')}
          </Button>
        </div>
      </Card>
      <ConfirmDialog
        open={confirming === 'old-photo'}
        title={t('oldPhotoTitle')}
        confirmLabel={t('oldPhotoConfirm')}
        cancelLabel={t('cancel')}
        onClose={() => setConfirming(null)}
        onConfirm={() => {
          setConfirming(null);
          requestSave('old-photo');
        }}
      >
        <p className="text-ash">{t('oldPhotoText')}</p>
      </ConfirmDialog>
      <ConfirmDialog
        open={confirming === 'seal'}
        title={t('sealTitle')}
        confirmLabel={t('save')}
        cancelLabel={t('cancel')}
        onClose={() => setConfirming(null)}
        onConfirm={() => {
          setConfirming(null);
          void save();
        }}
      >
        <p className="text-ash">{t('sealText')}</p>
      </ConfirmDialog>
    </>
  );
}

function JournalBody({ product, client }: { product: ProductDto; client: StudioClient }) {
  const t = useTranslations('studio.journal');
  const common = useTranslations('studio');
  const stages = useTranslations('stages');
  const format = useFormatter();
  const [journal, setJournal] = useState<JournalDto | null>(null);
  const [failed, setFailed] = useState(false);
  const [removing, setRemoving] = useState<JournalEntryDto | null>(null);
  const [form, setForm] = useState<{
    stage: JournalStage;
    corrects: JournalEntryDto | null;
  } | null>(null);

  const load = useCallback(async () => {
    setFailed(false);
    try {
      setJournal(await client.getJournal(product.id));
    } catch {
      setFailed(true);
    }
  }, [client, product.id]);
  useEffect(() => {
    void load();
  }, [load]);

  // Photos saved while still processing: refetch the journal when one is ready (event, else polling).
  const pendingPhotos = (journal?.entries ?? []).flatMap((entry) =>
    entry.images.flatMap((image) =>
      image.status === 'PROCESSING' && image.mediaId ? [image.mediaId] : [],
    ),
  );
  useMediaWatch(
    pendingPhotos,
    (id) => client.getMedia(id),
    () => void load(),
  );

  if (failed) {
    return <ErrorState message={common('loadFailed')} onRetry={() => void load()} />;
  }
  if (!journal) return <TableSkeleton label={common('loading')} className="" withHeader={false} />;

  // Đã từng xuất bản thì nhật ký chỉ ghi thêm: sửa sai bằng mốc đính chính.
  const sealed = product.publishedAt !== null;
  const recorded = new Set(journal.entries.map((e) => e.stage));
  const template = stageTemplateForCategory(product.category);
  const nextStage = template.find((s) => !recorded.has(s)) ?? 'finish';

  return (
    <>
      {sealed ? <p className="text-small text-ash">{t('published')}</p> : null}
      <section aria-labelledby="template-title">
        <h2 id="template-title" className="text-h3">
          {t('template')}
        </h2>
        <ol className="mt-3 flex flex-wrap gap-2" data-testid="stage-template">
          {template.map((stage) => (
            <li key={stage}>
              <Badge tone={recorded.has(stage) ? 'lacquer' : 'outline'}>
                {stages(`${stage}.name`)} · {recorded.has(stage) ? t('stageDone') : t('stageTodo')}
              </Badge>
            </li>
          ))}
        </ol>
      </section>

      {form ? (
        <EntryForm
          product={product}
          client={client}
          journal={journal}
          stage={form.stage}
          corrects={form.corrects}
          onClose={() => setForm(null)}
          onSaved={(updated) => {
            setJournal(updated);
            setForm(null);
          }}
        />
      ) : (
        <div>
          <Button type="button" onClick={() => setForm({ stage: nextStage, corrects: null })}>
            {t('addStage')}
          </Button>
        </div>
      )}

      {journal.entries.length === 0 ? (
        <EmptyState
          illustration="scroll"
          headingLevel="h3"
          title={t('empty')}
          description={t('emptyHint')}
          action={
            form ? undefined : (
              <Button type="button" onClick={() => setForm({ stage: nextStage, corrects: null })}>
                {t('addStage')}
              </Button>
            )
          }
        />
      ) : (
        <ol className="flex flex-col gap-3" data-testid="journal-entries">
          {[...journal.entries].reverse().map((entry) => (
            <li key={entry.id}>
              <Card className="flex flex-col gap-2 p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="font-sans text-body font-semibold">
                    {String(entry.seq + 1).padStart(2, '0')} · {stages(`${entry.stage}.name`)}
                  </h3>
                  <time dateTime={entry.declaredDate} className="text-small text-ash">
                    {formatDeclaredDate(format, entry.declaredDate)}
                  </time>
                </div>
                <p className="text-small">{entry.note}</p>
                {entry.images.length > 0 ? (
                  <ul className="flex flex-wrap gap-2" data-testid="entry-photos">
                    {entry.images.map((image) => (
                      <li key={image.sha256} className="w-32">
                        {image.url ? (
                          <ImageSlot
                            alt={stages(`${entry.stage}.name`)}
                            tint="#9a8064"
                            ratio="4/3"
                            src={image.url}
                            variants={image.variants}
                            thumbhash={image.thumbhash}
                            sizes="8rem"
                          />
                        ) : image.status === 'FAILED' ? (
                          <p role="alert" className="text-small text-seal">
                            {t('photoUnavailable')}
                          </p>
                        ) : (
                          <ImageSlot alt="" tint="#9a8064" ratio="4/3">
                            <span
                              role="status"
                              className="absolute inset-x-0 bottom-0 bg-paper/80 p-1 text-center text-[0.7rem] text-ash"
                            >
                              {t('photoProcessing')}
                            </span>
                          </ImageSlot>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : null}
                {entry.supersedesSeq !== null ? (
                  <p className="text-small text-clay">
                    {t('corrects', { n: entry.supersedesSeq + 1 })}
                  </p>
                ) : null}
                {entry.supersededBySeq !== null ? (
                  <p className="text-small text-ash">
                    {t('correctedBy', { n: entry.supersededBySeq + 1 })}
                  </p>
                ) : null}
                <div>
                  {sealed ? (
                    entry.supersededBySeq === null && entry.supersedesSeq === null ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setForm({ stage: entry.stage, corrects: entry })}
                      >
                        {t('correct')}
                      </Button>
                    ) : null
                  ) : (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setRemoving(entry)}
                    >
                      {t('delete')}
                    </Button>
                  )}
                </div>
              </Card>
            </li>
          ))}
        </ol>
      )}
      <ConfirmDialog
        open={removing !== null}
        tone="seal"
        title={t('deleteTitle')}
        confirmLabel={t('delete')}
        cancelLabel={t('cancel')}
        onClose={() => setRemoving(null)}
        onConfirm={() => {
          const entry = removing;
          setRemoving(null);
          if (!entry) return;
          void client
            .deleteJournalEntry(entry.id, entry.version)
            .then((updated) => {
              setJournal(updated);
              notify.success(t('deletedToast'));
            })
            .catch(() => notify.error(t('deleteFailed')));
        }}
      >
        <p className="text-ash">{t('deleteText')}</p>
      </ConfirmDialog>
    </>
  );
}

/** Nhật ký sản xuất của một sản phẩm (FR-PRD-03 … 05, FR-MEDIA-02). */
export function JournalEditor({ productId, client }: { productId: string; client?: StudioClient }) {
  const t = useTranslations('studio.journal');
  const products = useTranslations('studio.products');
  const nav = useTranslations('studio.nav');
  return (
    <HouseholdGate client={client}>
      {({ household, client: live }) => {
        const product = household.products.find((p) => p.id === productId);
        if (!product) {
          return (
            <EmptyState
              className="py-section"
              illustration="vase"
              title={products('notFound')}
              action={
                <Link href="/studio/san-pham" className={buttonVariants({ variant: 'secondary' })}>
                  {products('title')}
                </Link>
              }
            />
          );
        }
        return (
          <div className="mx-auto flex max-w-editorial flex-col gap-6 px-gutter py-8 pb-24 md:pb-12">
            <Breadcrumbs
              items={[
                { label: nav('home'), href: '/studio' },
                { label: products('title'), href: '/studio/san-pham' },
                {
                  label: product.name,
                  href: { pathname: '/studio/san-pham/[id]', params: { id: product.id } },
                },
                { label: t('breadcrumb') },
              ]}
            />
            <header className="flex flex-wrap items-center justify-between gap-4">
              <h1 className="text-h2">{t('title', { product: product.name })}</h1>
              <Link
                href={{ pathname: '/studio/san-pham/[id]', params: { id: product.id } }}
                className={buttonVariants({ variant: 'ghost' })}
              >
                {t('back')}
              </Link>
            </header>
            <JournalBody product={product} client={live} />
          </div>
        );
      }}
    </HouseholdGate>
  );
}
