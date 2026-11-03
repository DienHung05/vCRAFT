'use client';

import { isInBatTrang } from '@vcraft/domain';
import { Button } from '@vcraft/ui';
import dynamic from 'next/dynamic';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { FormAlert, TextField } from './fields';
import type { Coordinates } from './location-map';

// MapLibre nặng và cần trình duyệt: chỉ tải khi bước vị trí xưởng mở ra.
const LocationMap = dynamic(() => import('./location-map'), {
  ssr: false,
  loading: () => <MapPlaceholder />,
});

function MapPlaceholder() {
  const t = useTranslations('auth.wizard.map');
  return (
    <div
      role="status"
      className="grid h-72 place-items-center rounded-card bg-ink/5 text-small text-ash md:h-96"
    >
      {t('loading')}
    </div>
  );
}

/** Số thập phân hợp lệ trong khoảng, hoặc `null`. Chấp nhận dấu phẩy thập phân (bàn phím Việt). */
function parseCoordinate(text: string, min: number, max: number): number | null {
  const trimmed = text.trim().replace(',', '.');
  if (trimmed === '') return null;
  const n = Number(trimmed);
  return Number.isFinite(n) && n >= min && n <= max ? n : null;
}

export interface LocationPickerProps {
  value: Coordinates | null;
  onChange: (value: Coordinates | null) => void;
  /** Lỗi cấp trường (vd. chưa chọn vị trí) do form truyền xuống. */
  error?: string | undefined;
}

/**
 * Chọn vị trí xưởng (FR-AUTH-02): bản đồ MapLibre (nhấp hoặc kéo ghim) kèm ô vĩ độ/kinh độ và nút
 * dùng GPS. Ô tọa độ là đường dùng được bằng bàn phím và là phương án khi bản đồ không tải được
 * (WebGL tắt, mất mạng), nên bước này không bao giờ bị kẹt vì bản đồ.
 */
export function LocationPicker({ value, onChange, error }: LocationPickerProps) {
  const t = useTranslations('auth.wizard.map');
  const validation = useTranslations('auth.validation');
  const [mapFailed, setMapFailed] = useState(false);
  const [locating, setLocating] = useState<'idle' | 'busy' | 'denied'>('idle');
  const [latText, setLatText] = useState(value ? String(value.lat) : '');
  const [lngText, setLngText] = useState(value ? String(value.lng) : '');

  const sync = (nextLat: string, nextLng: string) => {
    const lat = parseCoordinate(nextLat, -90, 90);
    const lng = parseCoordinate(nextLng, -180, 180);
    onChange(lat !== null && lng !== null ? { lat, lng } : null);
  };

  // Chọn trên bản đồ hoặc GPS: đưa tọa độ ngược vào hai ô.
  const apply = (next: Coordinates) => {
    setLatText(String(next.lat));
    setLngText(String(next.lng));
    onChange(next);
  };

  const locateMe = () => {
    if (!navigator.geolocation) return setLocating('denied');
    setLocating('busy');
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setLocating('idle');
        apply({
          lat: Math.round(coords.latitude * 1e6) / 1e6,
          lng: Math.round(coords.longitude * 1e6) / 1e6,
        });
      },
      () => setLocating('denied'),
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  };

  const latInvalid = latText.trim() !== '' && parseCoordinate(latText, -90, 90) === null;
  const lngInvalid = lngText.trim() !== '' && parseCoordinate(lngText, -180, 180) === null;

  return (
    <div className="flex flex-col gap-3">
      {mapFailed ? (
        <FormAlert tone="info">{t('unavailable')}</FormAlert>
      ) : (
        <>
          <p className="text-small text-ash">{t('hint')}</p>
          <LocationMap
            value={value}
            onPick={apply}
            onFailure={() => setMapFailed(true)}
            label={t('label')}
            markerLabel={t('marker')}
          />
          <p className="text-[0.75rem] text-ash">{t('attribution')}</p>
        </>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label={t('lat')}
          inputMode="decimal"
          autoComplete="off"
          value={latText}
          error={latInvalid ? validation('latInvalid') : undefined}
          onChange={(event) => {
            setLatText(event.currentTarget.value);
            sync(event.currentTarget.value, lngText);
          }}
        />
        <TextField
          label={t('lng')}
          inputMode="decimal"
          autoComplete="off"
          value={lngText}
          error={lngInvalid ? validation('lngInvalid') : undefined}
          onChange={(event) => {
            setLngText(event.currentTarget.value);
            sync(latText, event.currentTarget.value);
          }}
        />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" variant="secondary" size="sm" onClick={locateMe}>
          {locating === 'busy' ? t('locating') : t('useMyLocation')}
        </Button>
        {locating === 'denied' ? (
          <span role="status" className="text-small text-ash">
            {t('locationDenied')}
          </span>
        ) : null}
      </div>
      {value && !isInBatTrang(value) ? (
        <p role="status" className="text-small text-clay">
          {t('outsideVillage')}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="text-small text-seal">
          {error}
        </p>
      ) : null}
    </div>
  );
}
