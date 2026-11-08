'use client';

import type { ProfilePhotoDto, UpdateHouseholdProfileRequest } from '@vcraft/contracts';
import { Button } from '@vcraft/ui';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { prepareImage, sendMedia } from '@/features/media/prepare-image';
import { browserAccessToken } from '@/lib/api/live-session';
import { inputClass } from './workshop-editor';

/** Uploads one image through the public media flow and returns its asset id. */
export async function uploadPublicImage(file: File): Promise<string> {
  const signal = new AbortController().signal;
  const prepared = await prepareImage(file, signal);
  const getToken = browserAccessToken() ?? (async () => null);
  return (await sendMedia(prepared.file, 'PRODUCT', getToken, () => undefined, signal)).id;
}

type PhotoKey = 'coverPhoto' | 'portraitPhoto' | 'sealPhoto';
type PhotoState = Record<PhotoKey, ProfilePhotoDto | null>;

const FIELDS: readonly { key: PhotoKey; altRequired: boolean }[] = [
  { key: 'coverPhoto', altRequired: true },
  { key: 'portraitPhoto', altRequired: true },
  { key: 'sealPhoto', altRequired: false },
];

/** Alt text rule: cover and portrait need a real description, the seal may go without one. */
export const photosValid = (photos: PhotoState) =>
  FIELDS.every(({ key, altRequired }) => {
    const photo = photos[key];
    return !photo || !altRequired || photo.alt.trim().length >= 3;
  });

/** The request shape of the three photos: media id and description, or null to remove one. */
export function toPhotosRequest(photos: PhotoState): UpdateHouseholdProfileRequest {
  const own = (photo: ProfilePhotoDto | null) =>
    photo ? { mediaId: photo.mediaId, alt: photo.alt } : null;
  return {
    coverPhoto: own(photos.coverPhoto),
    portraitPhoto: own(photos.portraitPhoto),
    sealPhoto: own(photos.sealPhoto),
  };
}

/**
 * Cover photo, portrait and personal seal (FR-ART-01): upload, replace or remove each one. The cover and
 * the portrait need a description; the seal's is optional. Saving is done by the caller.
 */
export function PhotosFields({
  photos,
  onChange,
}: {
  photos: PhotoState;
  onChange: (photos: PhotoState) => void;
}) {
  const t = useTranslations('studio.profile');
  const [busy, setBusy] = useState<PhotoKey | null>(null);
  const [failed, setFailed] = useState<PhotoKey | null>(null);

  const attach = async (key: PhotoKey, file: File) => {
    setBusy(key);
    setFailed(null);
    try {
      const mediaId = await uploadPublicImage(file);
      onChange({
        ...photos,
        [key]: { mediaId, url: null, variants: [], alt: photos[key]?.alt ?? '' },
      });
    } catch {
      setFailed(key);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="grid gap-5 md:grid-cols-3">
      {FIELDS.map(({ key, altRequired }) => {
        const photo = photos[key];
        return (
          <fieldset key={key} className="flex min-w-0 flex-col gap-2" data-testid={`photo-${key}`}>
            <legend className="font-medium text-small">{t(key)}</legend>
            <p className="text-small text-ash">{t(`${key}Hint`)}</p>
            {photo ? (
              photo.url ? (
                // biome-ignore lint/performance/noImgElement: URL của kho media đã là bản tối ưu.
                <img
                  src={photo.url}
                  alt=""
                  className="aspect-4/3 w-full rounded-input object-cover"
                />
              ) : (
                <span className="grid aspect-4/3 w-full place-items-center rounded-input bg-ink/8 p-1 text-center text-[0.7rem] text-ash">
                  {t('processing')}
                </span>
              )
            ) : (
              <span className="grid aspect-4/3 w-full place-items-center rounded-input border border-ink/20 border-dashed p-1 text-center text-[0.7rem] text-ash">
                {t('photoNone')}
              </span>
            )}
            {photo ? (
              <input
                aria-label={t(altRequired ? 'photoAlt' : 'sealAlt')}
                placeholder={t(altRequired ? 'photoAlt' : 'sealAlt')}
                value={photo.alt}
                onChange={(event) =>
                  onChange({ ...photos, [key]: { ...photo, alt: event.target.value } })
                }
                className={inputClass}
              />
            ) : null}
            <div className="flex flex-wrap items-center gap-2">
              <label className="w-fit cursor-pointer rounded-input border border-ink/20 px-3 py-1.5 text-small hover:bg-ink/6">
                {busy === key ? t('photoUploading') : photo ? t('photoReplace') : t('photoUpload')}
                <input
                  type="file"
                  accept="image/*,.heic,.heif"
                  className="sr-only"
                  aria-label={`${t(key)}: ${photo ? t('photoReplace') : t('photoUpload')}`}
                  disabled={busy === key}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.target.value = '';
                    if (file) void attach(key, file);
                  }}
                />
              </label>
              {photo ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-label={`${t(key)}: ${t('photoRemove')}`}
                  onClick={() => onChange({ ...photos, [key]: null })}
                >
                  {t('photoRemove')}
                </Button>
              ) : null}
            </div>
            {failed === key ? (
              <p role="alert" className="text-small text-seal">
                {t('photoFailed')}
              </p>
            ) : null}
          </fieldset>
        );
      })}
    </div>
  );
}
