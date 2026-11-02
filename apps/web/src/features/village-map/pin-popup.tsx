'use client';

import type { MapPinDto } from '@vcraft/contracts';
import { ProductFigure } from '@vcraft/ui';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { pinOpenState } from './map-model';

/** Dòng trạng thái mở cửa dùng chung cho popup và danh sách (FR-MAP-02). */
export function OpenStatus({ pin, now }: { pin: MapPinDto; now: Date }) {
  const t = useTranslations('villageMap');
  if (!pin.visitable) return <span className="text-ash">{t('productionOnly')}</span>;
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

/** Popup khi bấm ghim: ảnh bìa, tên hộ, nghề, trạng thái mở cửa, liên kết tới trang hộ. */
export function PinPopup({ pin, now }: { pin: MapPinDto; now: Date }) {
  const t = useTranslations('villageMap');
  return (
    <div className="flex flex-col gap-2 font-sans text-ink">
      {pin.household.coverUrl ? (
        // biome-ignore lint/performance/noImgElement: ảnh bìa có thể là URL của kho media, không qua next/image.
        <img
          src={pin.household.coverUrl}
          alt=""
          className="aspect-[3/2] w-full rounded-input object-cover"
          loading="lazy"
        />
      ) : (
        <div className="grid aspect-[3/2] place-items-center rounded-input bg-paper">
          <ProductFigure
            kind="generic"
            className="h-3/4 opacity-80"
            body="var(--color-glaze)"
            band="var(--color-paper)"
          />
        </div>
      )}
      <p className="font-medium text-body">{pin.household.name}</p>
      <p className="text-small text-ash">{pin.workshopName}</p>
      {pin.household.craft ? <p className="text-small">{pin.household.craft}</p> : null}
      <p className="text-small">
        <OpenStatus pin={pin} now={now} />
      </p>
      <Link
        href={{ pathname: '/nghe-nhan/[slug]', params: { slug: pin.household.slug } }}
        className="text-small text-clay underline underline-offset-4"
      >
        {t('viewHousehold')}
      </Link>
    </div>
  );
}
