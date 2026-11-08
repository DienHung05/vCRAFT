'use client';

import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { ApiError, type StudioClient } from '@vcraft/api-client';
import type {
  HouseholdDto,
  ProfilePhotoDto,
  UpdateHouseholdProfileRequest,
} from '@vcraft/contracts';
import {
  type CraftCategory,
  isValidIdNumber,
  PRODUCT_CATEGORIES,
  type ProductCategory,
} from '@vcraft/domain';
import { Badge, Button, Card } from '@vcraft/ui';
import { slugify } from '@vcraft/utils';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { prepareImage, sendMedia } from '@/features/media/prepare-image';
import { UploadList } from '@/features/media/upload-list';
import { type UploadItem, UploadQueue } from '@/features/media/upload-queue';
import { browserAccessToken } from '@/lib/api/live-session';
import { notify } from '@/lib/notify';
import { CraftFields } from './craft-fields';
import { HouseholdGate } from './household-gate';
import { PhotosFields, photosValid, toPhotosRequest, uploadPublicImage } from './profile-photos';
import { SlugAvailabilityNote } from './slug-availability-note';
import { StoryEditor } from './story-editor';
import { StorySuggestion } from './story-suggestion';
import { useSlugAvailability } from './use-slug-availability';
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

/** Representative's citizen ID number: shown masked, replaced by typing a new one (stored encrypted). */
function IdNumberSection({ household, client, reload }: SectionProps) {
  const t = useTranslations('studio.profile.idNumber');
  const [value, setValue] = useState('');
  const [state, setState] = useState<'idle' | 'saving' | 'invalid' | 'failed'>('idle');
  const save = async () => {
    if (!isValidIdNumber(value.trim())) return setState('invalid');
    setState('saving');
    try {
      await client.setIdNumber({ idNumber: value.trim() });
      setValue('');
      await reload();
      setState('idle');
      notify.success(t('saved'));
    } catch {
      setState('failed');
    }
  };
  return (
    <Card className="flex flex-col gap-3 p-5">
      <h2 className="text-h3">{t('title')}</h2>
      <p className="text-small text-ash">{t('lead')}</p>
      <p className="text-small">
        {household.idNumberMasked ? (
          <span className="font-mono">{household.idNumberMasked}</span>
        ) : (
          t('none')
        )}
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-small">
          {household.idNumberMasked ? t('replace') : t('add')}
          <input
            value={value}
            inputMode="numeric"
            autoComplete="off"
            maxLength={12}
            spellCheck={false}
            onChange={(event) => {
              setValue(event.target.value);
              setState('idle');
            }}
            className={inputClass}
          />
        </label>
        <Button
          type="button"
          disabled={state === 'saving' || value.trim() === ''}
          onClick={() => void save()}
        >
          {t('save')}
        </Button>
      </div>
      {state === 'invalid' ? (
        <p role="alert" className="text-small text-seal">
          {t('invalid')}
        </p>
      ) : null}
      {state === 'failed' ? (
        <p role="alert" className="text-small text-seal">
          {t('failed')}
        </p>
      ) : null}
    </Card>
  );
}

function StorySection({ household, client, reload }: SectionProps) {
  const t = useTranslations('studio.profile');
  const { state, save } = useSection(household, client, reload);
  const [history, setHistory] = useState(household.history);
  const [craft, setCraft] = useState(household.craft ?? '');
  const [craftCategory, setCraftCategory] = useState<CraftCategory | ''>(
    household.craftCategory ?? '',
  );
  const [foundedYear, setFoundedYear] = useState(household.foundedYear?.toString() ?? '');
  const [generations, setGenerations] = useState(household.generations?.toString() ?? '');
  return (
    <Card className="flex flex-col gap-4 p-5">
      <h2 className="text-h3">{t('story')}</h2>
      <StoryEditor value={history} label={t('storyLabel')} onChange={setHistory} />
      <StorySuggestion
        client={client}
        onInsert={(text) =>
          setHistory((current) => (current.trim() ? `${current.trim()}\n\n${text}` : text))
        }
      />
      <div className="grid gap-4 md:grid-cols-2">
        <CraftFields
          category={craftCategory}
          detail={craft}
          onCategory={setCraftCategory}
          onDetail={setCraft}
        />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
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
            craftCategory: craftCategory || null,
            foundedYear: foundedYear ? Number(foundedYear) : null,
            generations: generations ? Number(generations) : null,
          })
        }
      />
    </Card>
  );
}

/**
 * The household's public page address (FR-ART-01): suggested from the Vietnamese name, editable, and
 * checked live (300 ms after typing) so a duplicate shows before saving. Saving a taken address is still
 * refused by the API with `CONFLICT_DUPLICATE`.
 */
function SlugSection({ household, client, reload }: SectionProps) {
  const t = useTranslations('studio.profile');
  const common = useTranslations('studio');
  const [slug, setSlug] = useState(household.slug);
  const [state, setState] = useState<'idle' | 'saving' | 'taken' | 'stale' | 'failed'>('idle');
  const changed = slug !== household.slug;
  const check = useSlugAvailability(slug, (value) => client.slugAvailability(value), changed);
  const valid = slug === '' ? false : /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug);
  const save = async () => {
    setState('saving');
    try {
      await client.updateProfile(household.version, { slug });
      await reload();
      setState('idle');
      notify.success(common('saved'));
    } catch (error) {
      if (error instanceof ApiError && error.code === 'CONFLICT_DUPLICATE') {
        setState('taken');
      } else if (error instanceof ApiError && error.status === 409) {
        await reload();
        setState('stale');
      } else {
        setState('failed');
      }
    }
  };
  return (
    <Card className="flex flex-col gap-3 p-5">
      <h2 className="text-h3">{t('slugTitle')}</h2>
      <label className="flex flex-col gap-1 text-small">
        {t('slug')}
        <input
          value={slug}
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          aria-invalid={!valid || check.status === 'taken' || undefined}
          onChange={(event) => {
            setSlug(event.target.value);
            setState('idle');
          }}
          className={inputClass}
        />
      </label>
      <p className="text-small text-ash">{t('slugHint', { path: `/nghe-nhan/${slug || '…'}` })}</p>
      {!valid && slug !== '' ? (
        <p role="alert" className="text-small text-seal">
          {t('slugInvalid')}
        </p>
      ) : null}
      <SlugAvailabilityNote
        state={check}
        labels={{
          checking: t('slugChecking'),
          available: t('slugAvailable'),
          taken: t('slugTaken'),
          takenSuggest: (suggestion) => t('slugTakenSuggest', { slug: suggestion }),
          applySuggestion: (suggestion) => t('slugUseSuggestion', { slug: suggestion }),
          failed: t('slugCheckFailed'),
        }}
        onUseSuggestion={setSlug}
      />
      {changed ? (
        <p role="note" className="text-small text-ash">
          {t('slugWarning')}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            setSlug(slugify(household.name));
            setState('idle');
          }}
        >
          {t('slugFromName')}
        </Button>
        <Button
          type="button"
          disabled={!changed || !valid || state === 'saving' || check.status === 'taken'}
          onClick={() => void save()}
        >
          {common('save')}
        </Button>
      </div>
      {state === 'taken' ? (
        <p role="alert" className="text-small text-seal">
          {t('slugSaveTaken')}
        </p>
      ) : null}
      {state === 'stale' ? (
        <p role="alert" className="text-small text-seal">
          {common('stale')}
        </p>
      ) : null}
      {state === 'failed' ? (
        <p role="alert" className="text-small text-seal">
          {common('saveFailed')}
        </p>
      ) : null}
    </Card>
  );
}

/** Cover photo, portrait and personal seal (FR-ART-01); each saved together with its description. */
function PhotosSection({ household, client, reload }: SectionProps) {
  const t = useTranslations('studio.profile');
  const { state, save } = useSection(household, client, reload);
  const [photos, setPhotos] = useState({
    coverPhoto: household.coverPhoto,
    portraitPhoto: household.portraitPhoto,
    sealPhoto: household.sealPhoto,
  });
  const valid = photosValid(photos);
  return (
    <Card className="flex flex-col gap-4 p-5">
      <h2 className="text-h3">{t('photos')}</h2>
      <p className="text-small text-ash">{t('photosLead')}</p>
      <PhotosFields photos={photos} onChange={setPhotos} />
      {!valid ? (
        <p role="status" className="text-small text-seal">
          {t('altRequired')}
        </p>
      ) : null}
      <SaveBar state={state} disabled={!valid} onSave={() => void save(toPhotosRequest(photos))} />
    </Card>
  );
}

type TimelineRow = HouseholdDto['timeline'][number] & { uploading?: boolean; failed?: boolean };

/** The request shape of a milestone: the photo is sent as its media id and description only. */
function toTimelineInput(row: TimelineRow) {
  return {
    year: row.year,
    title: row.title,
    text: row.text,
    photo: row.photo ? { mediaId: row.photo.mediaId, alt: row.photo.alt } : null,
  };
}

/** Family milestones (FR-ART-02): add, edit, move up or down, delete, and an optional photo each. */
function TimelineSection({ household, client, reload }: SectionProps) {
  const t = useTranslations('studio.profile');
  const { state, save } = useSection(household, client, reload);
  const [events, setEvents] = useState<TimelineRow[]>(household.timeline);
  const patch = (index: number, change: Partial<TimelineRow>) =>
    setEvents((current) => current.map((e, i) => (i === index ? { ...e, ...change } : e)));
  const move = (index: number, by: -1 | 1) =>
    setEvents((current) => {
      const next = [...current];
      const [row] = next.splice(index, 1);
      if (row) next.splice(index + by, 0, row);
      return next;
    });
  const attach = async (index: number, file: File) => {
    patch(index, { uploading: true, failed: false });
    try {
      const signal = new AbortController().signal;
      const prepared = await prepareImage(file, signal);
      const getToken = browserAccessToken() ?? (async () => null);
      const asset = await sendMedia(prepared.file, 'PRODUCT', getToken, () => undefined, signal);
      patch(index, {
        uploading: false,
        photo: { mediaId: asset.id, url: null, variants: [], alt: '' },
      });
    } catch {
      patch(index, { uploading: false, failed: true });
    }
  };
  const valid = events.every((e) => !e.uploading && (!e.photo || e.photo.alt.trim().length >= 3));
  return (
    <Card className="flex flex-col gap-4 p-5">
      <h2 className="text-h3">{t('timeline')}</h2>
      <ol className="flex flex-col gap-4">
        {events.map((event, index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: dòng đang sửa chưa có khóa riêng.
          <li key={index} className="flex flex-col gap-2 border-ink/8 border-b pb-4">
            <div className="grid gap-2 md:grid-cols-[6rem_1fr_2fr]">
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
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {event.photo ? (
                <>
                  {event.photo.url ? (
                    // biome-ignore lint/performance/noImgElement: URL của kho media đã là bản tối ưu.
                    <img
                      src={event.photo.url}
                      alt=""
                      className="aspect-square w-16 rounded-input object-cover"
                    />
                  ) : (
                    <span className="grid aspect-square w-16 place-items-center rounded-input bg-ink/8 p-1 text-center text-[0.65rem] text-ash">
                      {t('processing')}
                    </span>
                  )}
                  <input
                    aria-label={t('alt')}
                    placeholder={t('alt')}
                    value={event.photo.alt}
                    onChange={(e) => {
                      const photo = event.photo;
                      if (photo) patch(index, { photo: { ...photo, alt: e.target.value } });
                    }}
                    className={`${inputClass} min-w-48 flex-1`}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => patch(index, { photo: null })}
                  >
                    {t('removePhoto')}
                  </Button>
                </>
              ) : (
                <label className="w-fit cursor-pointer rounded-input border border-ink/20 px-3 py-1.5 text-small hover:bg-ink/6">
                  {event.uploading ? t('uploadingPhoto') : t('addEventPhoto')}
                  <input
                    type="file"
                    accept="image/*,.heic,.heif"
                    className="sr-only"
                    disabled={event.uploading}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      e.target.value = '';
                      if (file) void attach(index, file);
                    }}
                  />
                </label>
              )}
              {event.failed ? (
                <span role="alert" className="text-small text-seal">
                  {t('photoFailed')}
                </span>
              ) : null}
              <span className="ml-auto flex gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={index === 0}
                  aria-label={t('moveUp', { title: event.title || String(event.year) })}
                  onClick={() => move(index, -1)}
                >
                  ↑
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={index === events.length - 1}
                  aria-label={t('moveDown', { title: event.title || String(event.year) })}
                  onClick={() => move(index, 1)}
                >
                  ↓
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setEvents(events.filter((_, i) => i !== index))}
                >
                  {t('remove')}
                </Button>
              </span>
            </div>
          </li>
        ))}
      </ol>
      <div>
        <Button
          type="button"
          variant="secondary"
          onClick={() =>
            setEvents([
              ...events,
              { year: new Date().getFullYear(), title: '', text: '', photo: null },
            ])
          }
        >
          {t('addEvent')}
        </Button>
      </div>
      <p className="text-small text-ash">{t('timelineOrderHint')}</p>
      {!valid ? (
        <p role="status" className="text-small text-seal">
          {t('altRequired')}
        </p>
      ) : null}
      <SaveBar
        state={state}
        onSave={() => {
          if (valid) void save({ timeline: events.map(toTimelineInput) });
        }}
      />
    </Card>
  );
}

type CertRow = {
  name: string;
  issuer: string;
  /** Legacy entries have only a year; new ones are dated. */
  year: number | null;
  /** `YYYY-MM-DD`, or empty while not dated. */
  issuedOn: string;
  photo: ProfilePhotoDto | null;
  verified: boolean;
  uploading?: boolean;
  failed?: boolean;
};

/** The request shape of a certification: a date wins over the legacy year; the photo is its media id and alt. */
export function toCertificationInput(
  row: CertRow,
): NonNullable<UpdateHouseholdProfileRequest['certifications']>[number] {
  return {
    name: row.name,
    issuer: row.issuer,
    ...(row.issuedOn ? { issuedOn: row.issuedOn } : row.year !== null ? { year: row.year } : {}),
    photo: row.photo ? { mediaId: row.photo.mediaId, alt: row.photo.alt } : null,
  };
}

/**
 * Certifications (FR-ART-03): name, issuer, issue date and an optional photo. Only the village board marks
 * one "verified"; any edit here drops that mark, so the badge shown is always the board's last word.
 */
function CertificationSection({ household, client, reload }: SectionProps) {
  const t = useTranslations('studio.profile');
  const { state, save } = useSection(household, client, reload);
  const [items, setItems] = useState<CertRow[]>(() =>
    household.certifications.map((c) => ({
      name: c.name,
      issuer: c.issuer,
      year: c.year,
      issuedOn: c.issuedOn ?? '',
      photo: c.photo,
      verified: c.verified,
    })),
  );
  const patch = (index: number, change: Partial<CertRow>) =>
    setItems((current) =>
      current.map((c, i) => (i === index ? { ...c, ...change, verified: false } : c)),
    );
  const attach = async (index: number, file: File) => {
    patch(index, { uploading: true, failed: false });
    try {
      const mediaId = await uploadPublicImage(file);
      patch(index, {
        uploading: false,
        photo: { mediaId, url: null, variants: [], alt: items[index]?.photo?.alt ?? '' },
      });
    } catch {
      patch(index, { uploading: false, failed: true });
    }
  };
  const dated = items.every((c) => c.issuedOn !== '' || c.year !== null);
  const altOk = items.every((c) => !c.photo || c.photo.alt.trim().length >= 3);
  const valid = dated && altOk && items.every((c) => !c.uploading);
  return (
    <Card className="flex flex-col gap-4 p-5">
      <h2 className="text-h3">{t('certifications')}</h2>
      <p className="text-small text-ash">{t('certVerifiedHint')}</p>
      <ul className="flex flex-col gap-4">
        {items.map((item, index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: dòng đang sửa chưa có khóa riêng, chỉ thêm và xóa.
          <li key={index} className="flex flex-col gap-2 border-ink/8 border-b pb-4">
            <div className="grid items-center gap-2 md:grid-cols-[2fr_2fr_10rem_auto_auto]">
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
                type="date"
                aria-label={t('certDate')}
                value={item.issuedOn}
                onChange={(e) => patch(index, { issuedOn: e.target.value })}
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
            </div>
            {item.issuedOn === '' && item.year !== null ? (
              <p className="text-small text-ash">{t('certLegacyYear', { year: item.year })}</p>
            ) : null}
            <div className="flex flex-wrap items-center gap-2">
              {item.photo ? (
                <>
                  {item.photo.url ? (
                    // biome-ignore lint/performance/noImgElement: URL của kho media đã là bản tối ưu.
                    <img
                      src={item.photo.url}
                      alt=""
                      className="aspect-square w-16 rounded-input object-cover"
                    />
                  ) : (
                    <span className="grid aspect-square w-16 place-items-center rounded-input bg-ink/8 p-1 text-center text-[0.65rem] text-ash">
                      {t('processing')}
                    </span>
                  )}
                  <input
                    aria-label={t('alt')}
                    placeholder={t('alt')}
                    value={item.photo.alt}
                    onChange={(e) => {
                      const photo = item.photo;
                      if (photo) patch(index, { photo: { ...photo, alt: e.target.value } });
                    }}
                    className={`${inputClass} min-w-48 flex-1`}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => patch(index, { photo: null })}
                  >
                    {t('removePhoto')}
                  </Button>
                </>
              ) : (
                <label className="w-fit cursor-pointer rounded-input border border-ink/20 px-3 py-1.5 text-small hover:bg-ink/6">
                  {item.uploading ? t('uploadingPhoto') : t('certAddPhoto')}
                  <input
                    type="file"
                    accept="image/*,.heic,.heif"
                    className="sr-only"
                    disabled={item.uploading}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      e.target.value = '';
                      if (file) void attach(index, file);
                    }}
                  />
                </label>
              )}
              {item.failed ? (
                <span role="alert" className="text-small text-seal">
                  {t('photoFailed')}
                </span>
              ) : null}
            </div>
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
              { name: '', issuer: '', year: null, issuedOn: '', photo: null, verified: false },
            ])
          }
        >
          {t('addCertification')}
        </Button>
      </div>
      {!dated ? (
        <p role="status" className="text-small text-seal">
          {t('certDateRequired')}
        </p>
      ) : null}
      {!altOk ? (
        <p role="status" className="text-small text-seal">
          {t('altRequired')}
        </p>
      ) : null}
      <SaveBar
        state={state}
        disabled={!valid}
        onSave={() => void save({ certifications: items.map(toCertificationInput) })}
      />
    </Card>
  );
}

const MAX_GALLERY = 30;
type GalleryRow = HouseholdDto['gallery'][number];

/** Stable identity of a gallery row for drag and drop: its media id, or the preset photo URL. */
const rowId = (row: GalleryRow) => row.mediaId ?? row.url ?? '';

function SortableGalleryRow({
  row,
  index,
  total,
  onPatch,
  onRemove,
  onMove,
}: {
  row: GalleryRow;
  index: number;
  total: number;
  onPatch: (change: Partial<GalleryRow>) => void;
  onRemove: () => void;
  onMove: (by: -1 | 1) => void;
}) {
  const t = useTranslations('studio.profile');
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: rowId(row) });
  return (
    <li
      ref={setNodeRef}
      style={{
        transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
        transition,
      }}
      className={`grid items-center gap-3 rounded-card bg-surface p-2 ring-1 ring-ink/8 md:grid-cols-[auto_6rem_2fr_1fr_auto] ${isDragging ? 'z-10 shadow-warm' : ''}`}
    >
      <button
        type="button"
        ref={setActivatorNodeRef}
        aria-label={t('galleryDrag', { n: index + 1 })}
        className="cursor-grab touch-none rounded-input px-2 py-3 text-ash hover:bg-ink/6"
        {...attributes}
        {...listeners}
      >
        ⠿
      </button>
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
        onChange={(e) => onPatch({ alt: e.target.value })}
        className={inputClass}
      />
      <input
        aria-label={t('caption')}
        placeholder={t('caption')}
        value={row.caption ?? ''}
        onChange={(e) => onPatch({ caption: e.target.value })}
        className={inputClass}
      />
      <span className="flex gap-1">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={index === 0}
          aria-label={t('galleryMoveUp', { n: index + 1 })}
          onClick={() => onMove(-1)}
        >
          ↑
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={index === total - 1}
          aria-label={t('galleryMoveDown', { n: index + 1 })}
          onClick={() => onMove(1)}
        >
          ↓
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onRemove}>
          {t('remove')}
        </Button>
      </span>
    </li>
  );
}

/** Workshop photos (FR-ART-04): upload, captions, mandatory alt text, and reorder by drag or by buttons. */
function GallerySection({ household, client, reload }: SectionProps) {
  const t = useTranslations('studio.profile');
  const media = useTranslations('media');
  const { state, save } = useSection(household, client, reload);
  const [rows, setRows] = useState<GalleryRow[]>(household.gallery);
  const [uploads, setUploads] = useState<readonly UploadItem<string>[]>([]);
  const [skipped, setSkipped] = useState(0);
  const [moved, setMoved] = useState('');
  const seen = useRef(new Set<string>());
  const queue = useRef<UploadQueue<string> | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

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
            : [
                ...current,
                {
                  mediaId,
                  url: null,
                  variants: [],
                  alt: '',
                  altEn: null,
                  caption: null,
                  credit: null,
                },
              ],
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
  const reorder = (from: number, to: number) => {
    if (from === to || to < 0 || to >= rows.length) return;
    setRows(arrayMove(rows, from, to));
    setMoved(t('galleryMoved', { position: to + 1, total: rows.length }));
  };
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    reorder(
      rows.findIndex((row) => rowId(row) === active.id),
      rows.findIndex((row) => rowId(row) === over.id),
    );
  };

  return (
    <Card className="flex flex-col gap-4 p-5">
      <h2 className="text-h3">{t('gallery')}</h2>
      <p className="text-small text-ash">{t('galleryHint')}</p>
      {rows.length > 1 ? <p className="text-small text-ash">{t('galleryOrderHint')}</p> : null}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={rows.map(rowId)} strategy={verticalListSortingStrategy}>
          <ul className="flex flex-col gap-3" data-testid="gallery-rows">
            {rows.map((row, index) => (
              <SortableGalleryRow
                key={rowId(row) || index}
                row={row}
                index={index}
                total={rows.length}
                onPatch={(change) => patch(index, change)}
                onRemove={() => setRows(rows.filter((_, i) => i !== index))}
                onMove={(by) => reorder(index, index + by)}
              />
            ))}
          </ul>
        </SortableContext>
      </DndContext>
      <p role="status" aria-live="polite" className="sr-only">
        {moved}
      </p>
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
          <IdNumberSection {...view} />
          <StorySection {...view} />
          <SlugSection {...view} />
          <PhotosSection {...view} />
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
