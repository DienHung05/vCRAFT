'use client';

import { ApiError, type StudioClient } from '@vcraft/api-client';
import type { HouseholdDto, UpdateHouseholdProfileRequest } from '@vcraft/contracts';
import { PRODUCT_CATEGORIES, type ProductCategory } from '@vcraft/domain';
import { Badge, Button, Card } from '@vcraft/ui';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { prepareImage, sendMedia } from '@/features/media/prepare-image';
import { UploadList } from '@/features/media/upload-list';
import { type UploadItem, UploadQueue } from '@/features/media/upload-queue';
import { browserAccessToken } from '@/lib/api/live-session';
import { notify } from '@/lib/notify';
import { HouseholdGate } from './household-gate';
import { inputClass, WorkshopEditor } from './workshop-editor';

type SaveState = 'idle' | 'saving' | 'stale' | 'failed';

/** Một khối sửa có nút lưu riêng; bản cũ (409) tự tải lại để không ghi đè người khác. */
function useSection(household: HouseholdDto, client: StudioClient, reload: () => Promise<void>) {
  const common = useTranslations('studio');
  const [state, setState] = useState<SaveState>('idle');
  const save = async (body: UpdateHouseholdProfileRequest) => {
    setState('saving');
    try {
      await client.updateProfile(household.version, body);
      await reload();
      setState('idle');
      notify.success(common('saved'));
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        await reload();
        setState('stale');
      } else {
        setState('failed');
      }
    }
  };
  return { state, save };
}

function SaveBar({
  state,
  onSave,
  disabled = false,
}: {
  state: SaveState;
  onSave: () => void;
  disabled?: boolean;
}) {
  const t = useTranslations('studio');
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button type="button" disabled={state === 'saving' || disabled} onClick={onSave}>
        {t('save')}
      </Button>
      {state === 'stale' ? (
        <p role="alert" className="text-small text-seal">
          {t('stale')}
        </p>
      ) : null}
      {state === 'failed' ? (
        <p role="alert" className="text-small text-seal">
          {t('saveFailed')}
        </p>
      ) : null}
    </div>
  );
}

interface SectionProps {
  household: HouseholdDto;
  client: StudioClient;
  reload: () => Promise<void>;
}

function StorySection({ household, client, reload }: SectionProps) {
  const t = useTranslations('studio.profile');
  const { state, save } = useSection(household, client, reload);
  const [history, setHistory] = useState(household.history);
  const [craft, setCraft] = useState(household.craft ?? '');
  const [foundedYear, setFoundedYear] = useState(household.foundedYear?.toString() ?? '');
  const [generations, setGenerations] = useState(household.generations?.toString() ?? '');
  return (
    <Card className="flex flex-col gap-4 p-5">
      <h2 className="text-h3">{t('story')}</h2>
      <label className="flex flex-col gap-1 text-small">
        {t('storyLabel')}
        <textarea
          rows={7}
          value={history}
          onChange={(event) => setHistory(event.target.value)}
          className={inputClass}
        />
      </label>
      <div className="grid gap-4 md:grid-cols-3">
        <label className="flex flex-col gap-1 text-small">
          {t('craft')}
          <input
            value={craft}
            onChange={(event) => setCraft(event.target.value)}
            className={inputClass}
          />
        </label>
        <label className="flex flex-col gap-1 text-small">
          {t('foundedYear')}
          <input
            type="number"
            min={1000}
            max={2100}
            value={foundedYear}
            onChange={(event) => setFoundedYear(event.target.value)}
            className={inputClass}
          />
        </label>
        <label className="flex flex-col gap-1 text-small">
          {t('generations')}
          <input
            type="number"
            min={1}
            max={50}
            value={generations}
            onChange={(event) => setGenerations(event.target.value)}
            className={inputClass}
          />
        </label>
      </div>
      <SaveBar
        state={state}
        onSave={() =>
          void save({
            history,
            craft,
            foundedYear: foundedYear ? Number(foundedYear) : null,
            generations: generations ? Number(generations) : null,
          })
        }
      />
    </Card>
  );
}

function TimelineSection({ household, client, reload }: SectionProps) {
  const t = useTranslations('studio.profile');
  const { state, save } = useSection(household, client, reload);
  const [events, setEvents] = useState(household.timeline);
  const patch = (index: number, change: Partial<(typeof events)[number]>) =>
    setEvents(events.map((e, i) => (i === index ? { ...e, ...change } : e)));
  return (
    <Card className="flex flex-col gap-4 p-5">
      <h2 className="text-h3">{t('timeline')}</h2>
      <ol className="flex flex-col gap-3">
        {events.map((event, index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: dòng đang sửa chưa có khóa riêng, chỉ thêm và xóa.
          <li key={index} className="grid gap-2 md:grid-cols-[6rem_1fr_2fr_auto]">
            <input
              type="number"
              aria-label={t('year')}
              value={event.year}
              onChange={(e) => patch(index, { year: Number(e.target.value) })}
              className={inputClass}
            />
            <input
              aria-label={t('eventTitle')}
              placeholder={t('eventTitle')}
              value={event.title}
              onChange={(e) => patch(index, { title: e.target.value })}
              className={inputClass}
            />
            <input
              aria-label={t('eventText')}
              placeholder={t('eventText')}
              value={event.text}
              onChange={(e) => patch(index, { text: e.target.value })}
              className={inputClass}
            />
            <Button
              type="button"
              variant="ghost"
              onClick={() => setEvents(events.filter((_, i) => i !== index))}
            >
              {t('remove')}
            </Button>
          </li>
        ))}
      </ol>
      <div>
        <Button
          type="button"
          variant="secondary"
          onClick={() =>
            setEvents([...events, { year: new Date().getFullYear(), title: '', text: '' }])
          }
        >
          {t('addEvent')}
        </Button>
      </div>
      <SaveBar state={state} onSave={() => void save({ timeline: events })} />
    </Card>
  );
}

function CertificationSection({ household, client, reload }: SectionProps) {
  const t = useTranslations('studio.profile');
  const { state, save } = useSection(household, client, reload);
  const [items, setItems] = useState(household.certifications);
  const patch = (index: number, change: Partial<(typeof items)[number]>) =>
    setItems(items.map((c, i) => (i === index ? { ...c, ...change, verified: false } : c)));
  return (
    <Card className="flex flex-col gap-4 p-5">
      <h2 className="text-h3">{t('certifications')}</h2>
      <ul className="flex flex-col gap-3">
        {items.map((item, index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: dòng đang sửa chưa có khóa riêng, chỉ thêm và xóa.
          <li key={index} className="grid items-center gap-2 md:grid-cols-[2fr_2fr_6rem_auto_auto]">
            <input
              aria-label={t('certName')}
              placeholder={t('certName')}
              value={item.name}
              onChange={(e) => patch(index, { name: e.target.value })}
              className={inputClass}
            />
            <input
              aria-label={t('certIssuer')}
              placeholder={t('certIssuer')}
              value={item.issuer}
              onChange={(e) => patch(index, { issuer: e.target.value })}
              className={inputClass}
            />
            <input
              type="number"
              aria-label={t('year')}
              value={item.year}
              onChange={(e) => patch(index, { year: Number(e.target.value) })}
              className={inputClass}
            />
            <Badge tone={item.verified ? 'lacquer' : 'outline'}>
              {item.verified ? t('verified') : t('unverified')}
            </Badge>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setItems(items.filter((_, i) => i !== index))}
            >
              {t('remove')}
            </Button>
          </li>
        ))}
      </ul>
      <div>
        <Button
          type="button"
          variant="secondary"
          onClick={() =>
            setItems([
              ...items,
              { name: '', issuer: '', year: new Date().getFullYear(), verified: false },
            ])
          }
        >
          {t('addCertification')}
        </Button>
      </div>
      <SaveBar
        state={state}
        onSave={() =>
          void save({
            certifications: items.map(({ name, issuer, year }) => ({ name, issuer, year })),
          })
        }
      />
    </Card>
  );
}

const MAX_GALLERY = 30;
type GalleryRow = HouseholdDto['gallery'][number];

function GallerySection({ household, client, reload }: SectionProps) {
  const t = useTranslations('studio.profile');
  const media = useTranslations('media');
  const { state, save } = useSection(household, client, reload);
  const [rows, setRows] = useState<GalleryRow[]>(household.gallery);
  const [uploads, setUploads] = useState<readonly UploadItem<string>[]>([]);
  const [skipped, setSkipped] = useState(0);
  const seen = useRef(new Set<string>());
  const queue = useRef<UploadQueue<string> | null>(null);

  // Ảnh tải xong (id từ API) thành một dòng mới chờ nhập mô tả.
  useEffect(() => {
    for (const item of uploads) {
      if (item.status === 'done' && item.result && !seen.current.has(item.id)) {
        seen.current.add(item.id);
        const mediaId = item.result;
        // Server chống trùng theo SHA-256: tải lại đúng ảnh cũ trả về cùng id.
        setRows((current) =>
          current.some((row) => row.mediaId === mediaId)
            ? current
            : [...current, { mediaId, url: null, alt: '', caption: null, credit: null }],
        );
      }
    }
  }, [uploads]);

  const getQueue = () => {
    queue.current ??= new UploadQueue<string>(
      {
        prepare: prepareImage,
        send: async (file, onProgress, signal) => {
          const getToken = browserAccessToken() ?? (async () => null);
          const asset = await sendMedia(file, 'PRODUCT', getToken, onProgress, signal);
          return asset.id;
        },
      },
      setUploads,
      MAX_GALLERY,
    );
    return queue.current;
  };

  const valid = rows.every((row) => row.alt.trim().length >= 3);
  const patch = (index: number, change: Partial<GalleryRow>) =>
    setRows(rows.map((row, i) => (i === index ? { ...row, ...change } : row)));

  return (
    <Card className="flex flex-col gap-4 p-5">
      <h2 className="text-h3">{t('gallery')}</h2>
      <p className="text-small text-ash">{t('galleryHint')}</p>
      <ul className="flex flex-col gap-3">
        {rows.map((row, index) => (
          <li
            key={row.mediaId ?? row.url ?? index}
            className="grid items-center gap-3 md:grid-cols-[6rem_2fr_1fr_auto]"
          >
            {row.url ? (
              // biome-ignore lint/performance/noImgElement: URL của kho media đã là bản tối ưu.
              <img src={row.url} alt="" className="aspect-square w-24 rounded-input object-cover" />
            ) : (
              <span className="grid aspect-square w-24 place-items-center rounded-input bg-ink/8 p-1 text-center text-[0.7rem] text-ash">
                {t('processing')}
              </span>
            )}
            <input
              aria-label={t('alt')}
              placeholder={t('alt')}
              required
              value={row.alt}
              onChange={(e) => patch(index, { alt: e.target.value })}
              className={inputClass}
            />
            <input
              aria-label={t('caption')}
              placeholder={t('caption')}
              value={row.caption ?? ''}
              onChange={(e) => patch(index, { caption: e.target.value })}
              className={inputClass}
            />
            <Button
              type="button"
              variant="ghost"
              onClick={() => setRows(rows.filter((_, i) => i !== index))}
            >
              {t('remove')}
            </Button>
          </li>
        ))}
      </ul>
      <UploadList
        items={uploads}
        onCancel={(id) => getQueue().cancel(id)}
        onRetry={(id) => getQueue().retry(id)}
      />
      {skipped > 0 ? (
        <p role="status" className="text-small text-seal">
          {media('tooMany', { count: skipped })}
        </p>
      ) : null}
      <label className="w-fit cursor-pointer rounded-input border border-ink/20 px-4 py-2 text-small hover:bg-ink/6">
        {t('addPhotos')}
        <input
          type="file"
          accept="image/*,.heic,.heif"
          multiple
          className="sr-only"
          onChange={(event) => {
            setSkipped(getQueue().add([...(event.target.files ?? [])]));
            event.target.value = '';
          }}
        />
      </label>
      {!valid ? (
        <p role="status" className="text-small text-seal">
          {t('altRequired')}
        </p>
      ) : null}
      <SaveBar
        state={state}
        disabled={!valid}
        onSave={() =>
          void save({
            gallery: rows.flatMap((row): NonNullable<UpdateHouseholdProfileRequest['gallery']> => {
              const shared = {
                alt: row.alt,
                ...(row.caption ? { caption: row.caption } : {}),
              };
              if (row.mediaId) return [{ mediaId: row.mediaId, ...shared }];
              return row.url ? [{ url: row.url, ...shared }] : [];
            }),
          })
        }
      />
    </Card>
  );
}

function CapacitySection({ household, client, reload }: SectionProps) {
  const t = useTranslations('studio.profile');
  const categories = useTranslations('catalog.categories');
  const { state, save } = useSection(household, client, reload);
  const [values, setValues] = useState<Partial<Record<ProductCategory, string>>>(() =>
    Object.fromEntries(
      Object.entries(household.capacityByCategory).map(([key, value]) => [key, String(value)]),
    ),
  );
  return (
    <Card className="flex flex-col gap-4 p-5">
      <h2 className="text-h3">{t('capacity')}</h2>
      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-5">
        {PRODUCT_CATEGORIES.map((category) => (
          <label key={category} className="flex flex-col gap-1 text-small">
            {categories(category)}
            <input
              type="number"
              min={0}
              inputMode="numeric"
              value={values[category] ?? ''}
              onChange={(event) => setValues({ ...values, [category]: event.target.value })}
              className={inputClass}
            />
          </label>
        ))}
      </div>
      <SaveBar
        state={state}
        onSave={() =>
          void save({
            capacityByCategory: Object.fromEntries(
              Object.entries(values)
                .filter(([, value]) => value !== '' && value !== undefined)
                .map(([key, value]) => [key, Number(value)]),
            ),
          })
        }
      />
    </Card>
  );
}

/** Hộ chưa có xưởng thì mở sẵn biểu mẫu; đã có thì thêm khi cần. Lưu xong xưởng hiện ở danh sách trên. */
function NewWorkshop({ household, client, reload }: SectionProps) {
  const t = useTranslations('studio.profile');
  const [adding, setAdding] = useState(false);
  if (!adding && household.workshops.length > 0) {
    return (
      <div>
        <Button type="button" variant="secondary" onClick={() => setAdding(true)}>
          {t('addWorkshop')}
        </Button>
      </div>
    );
  }
  return (
    <WorkshopEditor
      workshop={null}
      client={client}
      onSaved={async () => {
        await reload();
        setAdding(false);
      }}
    />
  );
}

/** Màn sửa hồ sơ của hộ (FR-ART-01 … 06): từng khối lưu riêng để sửa nhanh trên điện thoại. */
export function ProfileEditor({ client }: { client?: StudioClient }) {
  const t = useTranslations('studio.profile');
  return (
    <HouseholdGate client={client}>
      {(view) => (
        <div className="mx-auto flex max-w-editorial flex-col gap-6 px-gutter py-8 pb-24 md:pb-12">
          <header className="flex flex-col gap-2">
            <h1 className="text-h1">{t('title')}</h1>
            <p className="text-ash">{t('lead')}</p>
          </header>
          <StorySection {...view} />
          <TimelineSection {...view} />
          <CertificationSection {...view} />
          <GallerySection {...view} />
          <section aria-labelledby="workshops-title" className="flex flex-col gap-4">
            <h2 id="workshops-title" className="text-h3">
              {t('workshop')}
            </h2>
            {view.household.workshops.map((workshop) => (
              <WorkshopEditor
                key={workshop.id}
                workshop={workshop}
                client={view.client}
                onSaved={view.reload}
              />
            ))}
            <NewWorkshop {...view} />
          </section>
          <CapacitySection {...view} />
        </div>
      )}
    </HouseholdGate>
  );
}
