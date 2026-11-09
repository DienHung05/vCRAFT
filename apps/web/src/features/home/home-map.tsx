import { cn } from '@vcraft/ui';
import { getTranslations } from 'next-intl/server';
import { cache } from 'react';
import { projectPins } from '@/features/catalog/view-models';
import { pinOpenState, pinStatus } from '@/features/village-map/map-model';
import { fetchMapPins } from '@/features/village-map/map-pins';
import { VillageMiniMap } from '@/features/village-map/village-mini-map';

/** Pins are fetched once per render even though the list and the map stream in separate boundaries. */
const pinsForHome = cache(() => fetchMapPins());

/** "Đang mở cửa" list under the map heading. */
export async function HomeWorkshopList() {
  const [t, common, pinsResult] = await Promise.all([
    getTranslations('home'),
    getTranslations('common'),
    pinsForHome(),
  ]);
  if (pinsResult.status !== 'ok') {
    return <p className="mt-8 text-paper/75">{common('dataUnavailable')}</p>;
  }
  const now = new Date();
  const visitable = pinsResult.pins.filter((pin) => pin.visitable).slice(0, 6);
  if (visitable.length === 0) {
    return <p className="mt-8 text-paper/75">{t('map.empty')}</p>;
  }
  return (
    <ul className="mt-8 space-y-3">
      {visitable.map((pin) => {
        const state = pinOpenState(pin, now);
        return (
          <li
            key={pin.workshopId}
            className="flex items-center justify-between gap-4 border-paper/15 border-b pb-3"
          >
            <span>{pin.household.name}</span>
            <span className="flex items-center gap-2 text-small text-paper/75">
              <span
                aria-hidden="true"
                className={cn('size-2 rounded-full', state.open ? 'bg-celadon' : 'bg-paper/30')}
              />
              {state.open ? t('map.open', { hours: state.closesAt }) : t('map.closed')}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/** The hand-drawn mini map in the other column. */
export async function HomeMiniMap() {
  const [t, mapT, pinsResult] = await Promise.all([
    getTranslations('home'),
    getTranslations('villageMap'),
    pinsForHome(),
  ]);
  const now = new Date();
  const pins = pinsResult.status === 'ok' ? pinsResult.pins : [];
  const visitable = pins.filter((pin) => pin.visitable).slice(0, 6);
  const positions = projectPins(
    pins.map((pin) => ({ id: pin.workshopId, lat: pin.lat, lng: pin.lng })),
  );
  return (
    <VillageMiniMap
      label={t('map.mapLabel')}
      pins={visitable.map((pin) => ({
        id: pin.workshopId,
        ...(positions.get(pin.workshopId) ?? { x: 50, y: 50 }),
        open: pinOpenState(pin, now).open,
        label: pin.household.name,
        card: {
          title: pin.household.name,
          lines: [pin.workshopName, pin.address],
          status: pinStatus(pin, now),
          link: {
            href: { pathname: '/nghe-nhan/[slug]', params: { slug: pin.household.slug } },
            label: mapT('viewHousehold'),
          },
        },
      }))}
    />
  );
}
