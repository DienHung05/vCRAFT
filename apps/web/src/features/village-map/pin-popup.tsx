'use client';

import type { MapPinDto } from '@vcraft/contracts';
import { ProductFigure } from '@vcraft/ui';
import { useFormatter, useLocale, useTranslations } from 'next-intl';
import { craftLabel } from '@/features/catalog/craft-label';
import { Link } from '@/i18n/navigation';
import { directionsUrl, pinOpenState } from './map-model';

/** Dòng trạng thái mở cửa dùng chung cho popup và danh sách (FR-MAP-02). */
export function OpenStatus({ pin, now }: { pin: MapPinDto; now: Date }) {
  const t = useTranslations('villageMap');
  if (!pin.visitable) return <span className="text-ash">{t('productionOnly')}</span>;
  if (pin.temporarilyClosed) {
    return (
      <span className="font-medium text-seal">
        {pin.closureReason
          ? t('temporarilyClosedReason', { reason: pin.closureReason })
          : t('temporarilyClosed')}
      </span>
    );
  }
  const state = pinOpenState(pin, now);
  if (state.open) return <span className="font-medium text-glaze">{t('openNow')}</span>;
  if (!state.reopens) return <span className="text-ash">{t('noHours')}</span>;
  return (
    <span className="text-ash">
      {t('closedReopens', {
        day: t(`days.${state.reopens.day}` as 'days.0'),
        time: state.reopens.at,
      })}
    </span>
  );
}

/** One line on what the workshop offers visitors (FR-ART-05); nothing when it offers no experience. */
export function ExperienceSummary({ pin }: { pin: MapPinDto }) {
  const t = useTranslations('villageMap');
  const format = useFormatter();
  if (!pin.experience) return null;
  return (
    <p className="text-small">
      {t('experienceSummary', {
        minutes: pin.experience.durationMinutes,
        price: format.number(pin.experience.priceVnd, 'vnd'),
      })}
    </p>
  );
}

/**
 * Info card for a tapped pin, Google Maps style (GH#216): cover photo, household and workshop names,
 * craft, open status with the next opening time, address, visiting info, and two actions: the household
 * page and directions in Google Maps. Shown in a popup on wide screens and a bottom sheet on phones.
 */
export function PinPopup({
  pin,
  now,
  onClose,
}: {
  pin: MapPinDto;
  now: Date;
  /** Renders a close button in the card itself (the bottom sheet has no popup chrome). */
  onClose?: () => void;
}) {
  const t = useTranslations('villageMap');
  const crafts = useTranslations('catalog.craftCategories');
  const locale = useLocale();
  return (
    <div className="flex flex-col gap-2 font-sans text-ink">
      {pin.household.coverUrl ? (
        // biome-ignore lint/performance/noImgElement: ảnh bìa có thể là URL của kho media, không qua next/image.
        <img
          src={pin.household.coverUrl}
          alt=""
          className="aspect-[3/2] w-full rounded-input object-cover max-sm:aspect-[5/2]"
          loading="lazy"
        />
      ) : (
        <div className="grid aspect-[3/2] place-items-center rounded-input bg-paper max-sm:aspect-[5/2]">
          <ProductFigure
            kind="generic"
            className="h-3/4 opacity-80"
            body="var(--color-glaze)"
            band="var(--color-paper)"
          />
        </div>
      )}
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-medium text-body leading-snug">{pin.household.name}</p>
          <p className="text-small text-ash">
            {[pin.workshopName, craftLabel(locale, pin.household, (category) => crafts(category))]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </div>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            aria-label={t('closeCard')}
            className="-mt-1 -mr-1 grid size-11 shrink-0 place-items-center rounded-full text-h3 text-ash hover:bg-ink/6 hover:text-ink"
          >
            ×
          </button>
        ) : null}
      </div>
      <p className="text-small">
        <OpenStatus pin={pin} now={now} />
      </p>
      <p className="text-small text-ash">{pin.address}</p>
      {pin.visitingInfo ? <p className="text-small">{pin.visitingInfo}</p> : null}
      <ExperienceSummary pin={pin} />
      <div className="mt-1 flex flex-wrap gap-2">
        <Link
          href={{ pathname: '/nghe-nhan/[slug]', params: { slug: pin.household.slug } }}
          className="inline-flex min-h-11 items-center rounded-input bg-clay px-3 text-small font-medium text-paper hover:bg-clay/90"
        >
          {t('viewHousehold')}
        </Link>
        <a
          href={directionsUrl(pin)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-11 items-center rounded-input border border-ink/20 px-3 text-small font-medium hover:bg-ink/6"
        >
          {t('directions')}
        </a>
      </div>
    </div>
  );
}
