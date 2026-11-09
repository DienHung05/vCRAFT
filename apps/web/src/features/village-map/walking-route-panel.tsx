'use client';

import type { MapPinDto } from '@vcraft/contracts';
import { useFormatter, useTranslations } from 'next-intl';
import type { LatLng } from './map-model';
import { pinOpenState } from './map-model';
import { MAX_ROUTE_STOPS, routeLengthKm } from './walking-route';

export interface WalkingRouteView {
  start: LatLng;
  startKind: 'location' | 'workshop' | 'village';
  stops: readonly MapPinDto[];
}

/** The suggested walking route as a list of stops with their opening hours (FR-MAP-08). */
export function WalkingRoutePanel({
  route,
  now,
  onClear,
}: {
  route: WalkingRouteView;
  now: Date;
  onClear: () => void;
}) {
  const t = useTranslations('villageMap');
  const format = useFormatter();
  return (
    <div
      className="mb-6 rounded-card border border-glaze/30 bg-glaze/5 p-4"
      data-testid="walking-route"
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-h3">{t('routeTitle')}</h2>
        <button
          type="button"
          className="text-small text-clay underline underline-offset-4"
          onClick={onClear}
        >
          {t('routeClear')}
        </button>
      </div>
      <p className="mt-1 text-small text-ash">
        {t(`routeStart.${route.startKind}`)}
        {route.stops.length > 0
          ? ` · ${t('routeSummary', {
              count: route.stops.length,
              km: format.number(routeLengthKm(route.start, route.stops), {
                maximumFractionDigits: 1,
              }),
            })}`
          : ''}
      </p>
      {route.stops.length === 0 ? (
        <p role="status" className="mt-3 text-small">
          {t('routeEmpty')}
        </p>
      ) : (
        <>
          <ol className="mt-3 flex flex-col gap-2" data-testid="route-stops">
            {route.stops.map((pin, index) => {
              const state = pinOpenState(pin, now);
              return (
                <li key={pin.workshopId} className="text-small">
                  <span className="font-medium">
                    {index + 1}. {pin.household.name}
                  </span>
                  <span className="text-ash">
                    {' · '}
                    {pin.workshopName}
                    {state.open ? ` · ${t('routeOpenUntil', { time: state.closesAt })}` : ''}
                  </span>
                </li>
              );
            })}
          </ol>
          {route.stops.length === MAX_ROUTE_STOPS ? (
            <p className="mt-2 text-small text-ash">
              {t('routeLimited', { count: MAX_ROUTE_STOPS })}
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}
