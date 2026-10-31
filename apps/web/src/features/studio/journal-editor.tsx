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
import { useCallback, useEffect, useState } from 'react';
import { prepareImage, sendMedia } from '@/features/media/prepare-image';
import { Link } from '@/i18n/navigation';
import { browserAccessToken } from '@/lib/api/live-session';
import { HouseholdGate } from './household-gate';
import { inputClass } from './workshop-editor';

const OLD_PHOTO_DAYS = 30;
const PHOTO_POLL_MS = 2000;
const PHOTO_POLL_ATTEMPTS = 30;

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

/** Bản WebP rộng nhất đã xử lý xong, để ghi vào nhật ký kèm checksum ảnh gốc. */
export function journalImageOf(asset: MediaAssetResponse) {
  const variant = asset.variants
    .filter((v) => v.format === 'webp')
    .sort((a, b) => b.width - a.width)[0];
  return variant ? { url: variant.url, sha256: asset.sha256 } : null;
}

async function waitForReady(client: StudioClient, mediaId: string): Promise<MediaAssetResponse> {
  for (let attempt = 0; attempt < PHOTO_POLL_ATTEMPTS; attempt++) {
    const asset = await client.getMedia(mediaId);
    if (asset.status === 'READY') return asset;
    if (asset.status === 'FAILED') break;
    await new Promise((resolve) => setTimeout(resolve, PHOTO_POLL_MS));
  }
  throw new Error('photo-not-ready');
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
  const [status, setStatus] = useState<'idle' | 'photo' | 'saving' | 'photo-failed' | 'failed'>(
    'idle',
  );

  const facts = journal.entries.map((e) => ({ seq: e.seq, stage: e.stage }));
  const needsReason = !corrects && skippedStagesFor(facts, stage).length > 0;

  const onPhoto = async (file: File | undefined) => {
    if (!file) return;
    const prepared = await prepareImage(file, new AbortController().signal);
    setPhoto(prepared.file);
    if (prepared.capturedAt) {
      const fields = exifFields(prepared.capturedAt);
      setDate(fields.date);
      setTime(fields.time);
      setExif(isOldPhoto(prepared.capturedAt, new Date()) ? 'old' : 'filled');
    }
  };

  const save = async (withPhoto: boolean) => {
    setStatus(photo && withPhoto ? 'photo' : 'saving');
    try {
      let images: { url: string; sha256: string }[] = [];
      if (photo && withPhoto) {
        const getToken = browserAccessToken() ?? (async () => null);
        const uploaded = await sendMedia(
          photo,
          'JOURNAL',
          getToken,
          () => {},
          new AbortController().signal,
        );
        const image = journalImageOf(await waitForReady(client, uploaded.id));
        if (!image) throw new Error('photo-not-ready');
        images = [image];
        setStatus('saving');
      }
      const updated = await client.appendJournalEntry(product.id, {
        stage,
        declaredDate: date,
        note: noteWithTime(note, time),
        images,
        ...(needsReason && skipReason.trim() ? { skipReason: skipReason.trim() } : {}),
        ...(corrects ? { supersedesEntryId: corrects.id } : {}),
      });
      onSaved(updated);
    } catch (error) {
      setStatus(
        error instanceof Error && error.message === 'photo-not-ready' ? 'photo-failed' : 'failed',
      );
    }
  };

  return (
    <Card className="flex flex-col gap-4 p-5" data-testid="journal-form">
      <h2 className="text-h3">
        {corrects ? t('correctionTitle', { n: corrects.seq + 1 }) : t('addStage')}
      </h2>
      <label className="flex flex-col gap-1 text-small">
        {t('photo')}
        <input
          type="file"
          accept="image/*,.heic,.heif"
          capture="environment"
          onChange={(event) => void onPhoto(event.target.files?.[0])}
        />
      </label>
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
          onClick={() => void save(status !== 'photo-failed')}
        >
          {t('save')}
        </Button>
        <Button type="button" variant="ghost" onClick={onClose}>
          {t('cancel')}
        </Button>
      </div>
    </Card>
  );
}

function JournalBody({ product, client }: { product: ProductDto; client: StudioClient }) {
  const t = useTranslations('studio.journal');
  const common = useTranslations('studio');
  const stages = useTranslations('stages');
  const format = useFormatter();
  const [journal, setJournal] = useState<JournalDto | null>(null);
  const [failed, setFailed] = useState(false);
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

  if (failed) {
    return (
      <div role="alert" className="flex flex-col items-start gap-3">
        <p>{common('loadFailed')}</p>
        <Button type="button" variant="secondary" onClick={() => void load()}>
          {common('retry')}
        </Button>
      </div>
    );
  }
  if (!journal) return <p role="status">{common('loading')}</p>;

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
        <p className="text-ash">{t('empty')}</p>
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
                    {format.dateTime(new Date(entry.declaredDate), 'long')}
                  </time>
                </div>
                <p className="text-small">{entry.note}</p>
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
                      onClick={() =>
                        void client
                          .deleteJournalEntry(entry.id, entry.version)
                          .then(setJournal)
                          .catch(() => setFailed(true))
                      }
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
    </>
  );
}

/** Nhật ký sản xuất của một sản phẩm (FR-PRD-03 … 05, FR-MEDIA-02). */
export function JournalEditor({ productId, client }: { productId: string; client?: StudioClient }) {
  const t = useTranslations('studio.journal');
  const products = useTranslations('studio.products');
  return (
    <HouseholdGate client={client}>
      {({ household, client: live }) => {
        const product = household.products.find((p) => p.id === productId);
        if (!product) {
          return <p className="mx-auto max-w-editorial px-gutter py-12">{products('notFound')}</p>;
        }
        return (
          <div className="mx-auto flex max-w-editorial flex-col gap-6 px-gutter py-8 pb-24 md:pb-12">
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
