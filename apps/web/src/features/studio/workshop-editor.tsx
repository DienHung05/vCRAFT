'use client';

import type { StudioClient } from '@vcraft/api-client';
import type { CreateWorkshopRequest, OpeningIntervalDto, WorkshopDto } from '@vcraft/contracts';
import { VILLAGE_AREA_CODES } from '@vcraft/domain';
import { Button, Card } from '@vcraft/ui';
import dynamic from 'next/dynamic';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { notify } from '@/lib/notify';

const WorkshopMapPicker = dynamic(() => import('./workshop-map-picker'), {
  ssr: false,
  loading: () => <div className="size-full animate-pulse bg-paper" />,
});

/** Thứ hai trước, khớp lịch Việt Nam; `day` theo quy ước 0 = Chủ nhật của domain. */
const WEEK = [1, 2, 3, 4, 5, 6, 0] as const;
const DEFAULT_OPEN = '08:00';
const DEFAULT_CLOSE = '17:00';

export const inputClass = 'w-full rounded-input border border-ink/20 bg-surface px-3 py-2';

interface Draft {
  name: string;
  address: string;
  /** Hamlet code, or empty while not chosen (ADR-0023). */
  areaCode: WorkshopDto['areaCode'];
  purpose: WorkshopDto['purpose'];
  acceptsVisitors: boolean;
  visitingInfo: string;
  lat: number | null;
  lng: number | null;
  hours: OpeningIntervalDto[];
  offersExperience: boolean;
  experienceDescription: string;
  /** Kept as text while typing; empty until filled. */
  experienceDuration: string;
  experiencePrice: string;
  temporarilyClosed: boolean;
  closureReason: string;
}

const toDraft = (w: WorkshopDto | null): Draft => ({
  name: w?.name ?? '',
  address: w?.address ?? '',
  areaCode: w?.areaCode ?? null,
  purpose: w?.purpose ?? 'BOTH',
  acceptsVisitors: w?.acceptsVisitors ?? false,
  visitingInfo: w?.visitingInfo ?? '',
  lat: w?.lat ?? null,
  lng: w?.lng ?? null,
  hours: w?.openingHours ?? [],
  offersExperience: w?.experience != null,
  experienceDescription: w?.experience?.description ?? '',
  experienceDuration: w?.experience ? String(w.experience.durationMinutes) : '',
  experiencePrice: w?.experience ? String(w.experience.priceVnd) : '',
  temporarilyClosed: w?.temporarilyClosed ?? false,
  closureReason: w?.closureReason ?? '',
});

export function toWorkshopRequest(draft: Draft): CreateWorkshopRequest {
  return {
    name: draft.name.trim(),
    address: draft.address.trim(),
    areaCode: draft.areaCode,
    purpose: draft.purpose,
    acceptsVisitors: draft.acceptsVisitors,
    ...(draft.visitingInfo.trim() ? { visitingInfo: draft.visitingInfo.trim() } : {}),
    openingHours: draft.hours,
    ...(draft.offersExperience
      ? {
          experience: {
            description: draft.experienceDescription.trim(),
            durationMinutes: Number(draft.experienceDuration),
            priceVnd: Number(draft.experiencePrice),
          },
        }
      : {}),
    temporarilyClosed: draft.temporarilyClosed,
    ...(draft.temporarilyClosed && draft.closureReason.trim()
      ? { closureReason: draft.closureReason.trim() }
      : {}),
    ...(draft.lat !== null && draft.lng !== null ? { lat: draft.lat, lng: draft.lng } : {}),
  };
}

/** The experience offer and the closure reason must be filled in before the workshop can be saved. */
const isIncomplete = (draft: Draft): boolean =>
  (draft.offersExperience &&
    (draft.experienceDescription.trim().length < 5 ||
      !(Number(draft.experienceDuration) >= 5) ||
      draft.experiencePrice === '' ||
      Number(draft.experiencePrice) < 0)) ||
  (draft.temporarilyClosed && draft.closureReason.trim() === '');

/** Một xưởng (FR-ART-05): địa chỉ, tọa độ, giờ mở cửa theo tuần, cờ đón khách. */
export function WorkshopEditor({
  workshop,
  client,
  onSaved,
}: {
  workshop: WorkshopDto | null;
  client: StudioClient;
  onSaved: () => Promise<void>;
}) {
  const t = useTranslations('studio.profile');
  const common = useTranslations('studio');
  const days = useTranslations('villageMap.days');
  const areas = useTranslations('villageAreas');
  const [draft, setDraft] = useState(() => toDraft(workshop));
  const [status, setStatus] = useState<'idle' | 'saving' | 'failed' | 'denied'>('idle');
  const patch = (change: Partial<Draft>) => setDraft((current) => ({ ...current, ...change }));

  const toggleDay = (day: number, open: boolean) =>
    patch({
      hours: open
        ? [...draft.hours, { day, open: DEFAULT_OPEN, close: DEFAULT_CLOSE }]
        : draft.hours.filter((h) => h.day !== day),
    });
  const setTime = (day: number, field: 'open' | 'close', value: string) =>
    patch({ hours: draft.hours.map((h) => (h.day === day ? { ...h, [field]: value } : h)) });

  const pickMyLocation = () => {
    navigator.geolocation?.getCurrentPosition(
      ({ coords }) => patch({ lat: coords.latitude, lng: coords.longitude }),
      () => setStatus('denied'),
      { timeout: 8000 },
    );
  };

  const save = async () => {
    setStatus('saving');
    try {
      const body = toWorkshopRequest(draft);
      if (workshop) await client.updateWorkshop(workshop.id, workshop.version, body);
      else await client.addWorkshop(body);
      await onSaved();
      setStatus('idle');
      notify.success(common('saved'));
    } catch {
      setStatus('failed');
    }
  };

  return (
    <Card className="flex flex-col gap-4 p-5">
      <div className="grid gap-4 md:grid-cols-2">
        <label className="flex flex-col gap-1 text-small">
          {t('workshopName')}
          <input
            value={draft.name}
            onChange={(event) => patch({ name: event.target.value })}
            className={inputClass}
          />
        </label>
        <label className="flex flex-col gap-1 text-small">
          {t('purpose')}
          <select
            value={draft.purpose}
            onChange={(event) => patch({ purpose: event.target.value as Draft['purpose'] })}
            className={inputClass}
          >
            {(['PRODUCTION', 'SHOWROOM', 'BOTH'] as const).map((purpose) => (
              <option key={purpose} value={purpose}>
                {t(`purposes.${purpose}`)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="flex flex-col gap-1 text-small">
        {t('address')}
        <input
          value={draft.address}
          onChange={(event) => patch({ address: event.target.value })}
          className={inputClass}
        />
      </label>
      <label className="flex flex-col gap-1 text-small">
        {t('area')}
        <select
          value={draft.areaCode ?? ''}
          onChange={(event) =>
            patch({ areaCode: (event.target.value || null) as Draft['areaCode'] })
          }
          className={inputClass}
        >
          <option value="">{areas('none')}</option>
          {VILLAGE_AREA_CODES.map((code) => (
            <option key={code} value={code}>
              {areas(code)}
            </option>
          ))}
        </select>
        <span className="text-ash">{t('areaHint')}</span>
      </label>

      <div className="flex flex-col gap-2">
        <p className="text-small text-ash">{t('mapHint')}</p>
        <div className="h-64 overflow-hidden rounded-card" data-testid="workshop-map">
          <WorkshopMapPicker
            {...(workshop?.name ? { label: workshop.name } : {})}
            lat={draft.lat}
            lng={draft.lng}
            onPick={(lat, lng) => patch({ lat, lng })}
          />
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-small">
            {t('lat')}
            <input
              type="number"
              step="any"
              value={draft.lat ?? ''}
              onChange={(event) =>
                patch({ lat: event.target.value === '' ? null : Number(event.target.value) })
              }
              className={`${inputClass} w-36`}
            />
          </label>
          <label className="flex flex-col gap-1 text-small">
            {t('lng')}
            <input
              type="number"
              step="any"
              value={draft.lng ?? ''}
              onChange={(event) =>
                patch({ lng: event.target.value === '' ? null : Number(event.target.value) })
              }
              className={`${inputClass} w-36`}
            />
          </label>
          <Button type="button" variant="secondary" onClick={pickMyLocation}>
            {t('useMyLocation')}
          </Button>
        </div>
        {status === 'denied' ? (
          <p role="status" className="text-small text-seal">
            {t('locationDenied')}
          </p>
        ) : null}
      </div>

      <label className="flex items-center gap-2 text-small">
        <input
          type="checkbox"
          checked={draft.acceptsVisitors}
          onChange={(event) => patch({ acceptsVisitors: event.target.checked })}
        />
        {t('acceptsVisitors')}
      </label>
      <label className="flex flex-col gap-1 text-small">
        {t('visitingInfo')}
        <input
          value={draft.visitingInfo}
          onChange={(event) => patch({ visitingInfo: event.target.value })}
          className={inputClass}
        />
      </label>

      <label className="flex items-center gap-2 text-small">
        <input
          type="checkbox"
          checked={draft.offersExperience}
          onChange={(event) => patch({ offersExperience: event.target.checked })}
        />
        {t('experienceOffer')}
      </label>
      {draft.offersExperience ? (
        <div className="grid gap-4 md:grid-cols-[2fr_1fr_1fr]">
          <label className="flex flex-col gap-1 text-small">
            {t('experienceDescription')}
            <input
              value={draft.experienceDescription}
              onChange={(event) => patch({ experienceDescription: event.target.value })}
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1 text-small">
            {t('experienceDuration')}
            <input
              type="number"
              min={5}
              step={5}
              value={draft.experienceDuration}
              onChange={(event) => patch({ experienceDuration: event.target.value })}
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1 text-small">
            {t('experiencePrice')}
            <input
              type="number"
              min={0}
              step={1000}
              value={draft.experiencePrice}
              onChange={(event) => patch({ experiencePrice: event.target.value })}
              className={inputClass}
            />
          </label>
        </div>
      ) : null}

      <label className="flex items-center gap-2 text-small">
        <input
          type="checkbox"
          checked={draft.temporarilyClosed}
          onChange={(event) => patch({ temporarilyClosed: event.target.checked })}
        />
        {t('temporarilyClosed')}
      </label>
      {draft.temporarilyClosed ? (
        <label className="flex flex-col gap-1 text-small">
          {t('closureReason')}
          <input
            value={draft.closureReason}
            onChange={(event) => patch({ closureReason: event.target.value })}
            className={inputClass}
          />
          <span className="text-ash">{t('closureReasonHint')}</span>
        </label>
      ) : null}

      <fieldset className="flex flex-col gap-2">
        <legend className="text-small font-medium">{t('hours')}</legend>
        {WEEK.map((day) => {
          const interval = draft.hours.find((h) => h.day === day);
          const dayName = days(String(day) as '0');
          return (
            <div key={day} className="flex flex-wrap items-center gap-3 text-small">
              <label className="flex w-32 items-center gap-2">
                <input
                  type="checkbox"
                  checked={interval !== undefined}
                  onChange={(event) => toggleDay(day, event.target.checked)}
                />
                {dayName}
              </label>
              {interval ? (
                <>
                  <label className="flex items-center gap-1">
                    {t('open')}
                    <input
                      type="time"
                      aria-label={`${t('open')} ${dayName}`}
                      value={interval.open}
                      onChange={(event) => setTime(day, 'open', event.target.value)}
                      className="rounded-input border border-ink/20 bg-surface px-2 py-1"
                    />
                  </label>
                  <label className="flex items-center gap-1">
                    {t('close')}
                    <input
                      type="time"
                      aria-label={`${t('close')} ${dayName}`}
                      value={interval.close}
                      onChange={(event) => setTime(day, 'close', event.target.value)}
                      className="rounded-input border border-ink/20 bg-surface px-2 py-1"
                    />
                  </label>
                </>
              ) : (
                <span className="text-ash">{t('closed')}</span>
              )}
            </div>
          );
        })}
      </fieldset>

      <div className="flex items-center gap-3">
        <Button
          type="button"
          disabled={status === 'saving' || isIncomplete(draft)}
          onClick={() => void save()}
        >
          {common('save')}
        </Button>
        {status === 'failed' ? (
          <p role="alert" className="text-small text-seal">
            {common('saveFailed')}
          </p>
        ) : null}
      </div>
    </Card>
  );
}
