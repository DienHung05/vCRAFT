'use client';

import { createMapClient } from '@vcraft/api-client';
import type { MapPinDto } from '@vcraft/contracts';
import { Button } from '@vcraft/ui';
import dynamic from 'next/dynamic';
import { useFormatter, useLocale, useTranslations } from 'next-intl';
import { useEffect, useMemo, useRef, useState } from 'react';
import { EmptyState } from '@/components/states/empty-state';
import { Reveal } from '@/experience/motion/reveal';
import { craftLabel } from '@/features/catalog/craft-label';
import { Link } from '@/i18n/navigation';
import {
  craftsOf,
  distanceKm,
  filterPins,
  inBounds,
  type LatLng,
  type MapBounds,
  pinStatus,
  sortByDistance,
  villageCenter,
} from './map-model';
import { MapPlaceholder } from './map-placeholder';
import { ExperienceSummary, OpenStatus } from './pin-popup';
import { useMapStart } from './use-map-start';
import { type FetchViewportPins, useViewportPins } from './use-viewport-pins';
import { nearestNeighbourOrder } from './walking-route';
import { WalkingRoutePanel } from './walking-route-panel';

const MapCanvas = dynamic(() => import('./map-canvas'), {
  ssr: false,
  loading: () => <div className="size-full animate-pulse bg-paper" />,
});

function supportsWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return Boolean(canvas.getContext('webgl2') ?? canvas.getContext('webgl'));
  } catch {
    return false;
  }
}

type LocationState = 'idle' | 'locating' | 'denied';

type RouteStart = 'location' | 'workshop' | 'village';

interface WalkingRoute {
  start: LatLng;
  startKind: RouteStart;
  stops: MapPinDto[];
}

const mapClient = createMapClient();
const fetchViewportPins: FetchViewportPins = async (bbox, signal) =>
  (await mapClient.pinsInBbox(bbox, signal)).data;

/**
 * Bản đồ làng và danh sách xưởng đồng bộ hai chiều (FR-MAP-01…07). Danh sách luôn nằm trong trang,
 * nên không có WebGL hay dùng trình đọc màn hình vẫn đọc được đủ xưởng; chỉ khi người dùng tự kéo
 * bản đồ thì danh sách mới thu theo khung nhìn, và có nút trả lại toàn bộ.
 */
export function VillageMapExplorer({
  pins: initialPins,
  initialSelectedId,
  fetchPinsInViewport = fetchViewportPins,
}: {
  pins: readonly MapPinDto[];
  /** Loads the pins of a viewport (FR-MAP-04); a seam for tests. */
  fetchPinsInViewport?: FetchViewportPins;
  /** Workshop whose card is open when the page loads (`/ban-do?xuong=`). */
  initialSelectedId?: string;
}) {
  const t = useTranslations('villageMap');
  const tCraft = useTranslations('catalog.craftCategories');
  const locale = useLocale();
  const format = useFormatter();
  const viewport = useViewportPins(fetchPinsInViewport);
  // Chờ sau hydrate mới biết WebGL và giờ thật, để HTML máy chủ và trình duyệt khớp nhau.
  const [webgl, setWebgl] = useState<boolean | null>(null);
  const [now, setNow] = useState(() => new Date());
  const [openNow, setOpenNow] = useState(false);
  const [visitable, setVisitable] = useState(false);
  const [experience, setExperience] = useState(false);
  const [craft, setCraft] = useState('');
  const [bounds, setBounds] = useState<MapBounds | null>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(
    initialSelectedId && initialPins.some((pin) => pin.workshopId === initialSelectedId)
      ? initialSelectedId
      : null,
  );
  const [origin, setOrigin] = useState<LatLng | null>(null);
  const [locationState, setLocationState] = useState<LocationState>('idle');
  const [route, setRoute] = useState<WalkingRoute | null>(null);
  const routeRequest = useRef(0);
  // MapLibre boots after the list has painted (GH#481); a deep link to one workshop starts it at once.
  const [mapStarted, startMap] = useMapStart(webgl === true, initialSelectedId !== undefined);

  useEffect(() => {
    setWebgl(supportsWebGL());
    setNow(new Date());
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  // The server render carries every workshop; once the map is moved, its viewport answer replaces
  // them, keeping the open card's workshop so it does not vanish from under the visitor.
  const pins = useMemo<readonly MapPinDto[]>(() => {
    if (!viewport.pins) return initialPins;
    const keep = selectedId ? initialPins.find((pin) => pin.workshopId === selectedId) : undefined;
    return keep && !viewport.pins.some((pin) => pin.workshopId === keep.workshopId)
      ? [...viewport.pins, keep]
      : viewport.pins;
  }, [initialPins, viewport.pins, selectedId]);

  const crafts = useMemo(() => craftsOf(initialPins), [initialPins]);
  const filtered = useMemo(
    () => filterPins(pins, { openNow, visitable, experience, craft }, now),
    [pins, openNow, visitable, experience, craft, now],
  );
  const listed = useMemo(() => {
    const inView = bounds ? filtered.filter((pin) => inBounds(pin, bounds)) : filtered;
    return origin ? sortByDistance(inView, origin) : inView;
  }, [filtered, bounds, origin]);
  const selected = filtered.find((pin) => pin.workshopId === selectedId) ?? null;

  const buildRoute = (start: LatLng, startKind: RouteStart, excludeId?: string) => {
    const open = filtered.filter(
      (pin) => pin.workshopId !== excludeId && pinStatus(pin, now) === 'open',
    );
    setRoute({ start, startKind, stops: nearestNeighbourOrder(start, open) });
  };

  // Start: the visitor's location when allowed, else the selected workshop, else the village centre.
  const suggestRoute = () => {
    const fallback = () =>
      selected
        ? buildRoute({ lat: selected.lat, lng: selected.lng }, 'workshop', selected.workshopId)
        : buildRoute(villageCenter(), 'village');
    if (origin) {
      buildRoute(origin, 'location');
      return;
    }
    if (!('geolocation' in navigator)) {
      fallback();
      return;
    }
    const request = ++routeRequest.current;
    setLocationState('locating');
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setLocationState('idle');
        if (request !== routeRequest.current) return;
        const here = { lat: coords.latitude, lng: coords.longitude };
        setOrigin(here);
        buildRoute(here, 'location');
      },
      () => {
        setLocationState('denied');
        if (request === routeRequest.current) fallback();
      },
      { timeout: 8000 },
    );
  };

  const clearRoute = () => {
    routeRequest.current++;
    setRoute(null);
  };

  const locate = () => {
    if (!('geolocation' in navigator)) {
      setLocationState('denied');
      return;
    }
    setLocationState('locating');
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setOrigin({ lat: coords.latitude, lng: coords.longitude });
        setLocationState('idle');
      },
      () => setLocationState('denied'),
      { timeout: 8000 },
    );
  };

  return (
    <div className="mt-8 flex flex-col gap-6">
      {/* GH#301: the filter row + map + list rise once as a block (composite-only). */}
      <Reveal className="flex flex-col gap-6">
        <fieldset className="flex flex-wrap items-center gap-x-5 gap-y-3">
          <legend className="sr-only">{t('filtersLabel')}</legend>
          <label className="flex items-center gap-2 text-small">
            <input
              type="checkbox"
              checked={openNow}
              onChange={(event) => setOpenNow(event.target.checked)}
            />
            {t('filterOpenNow')}
          </label>
          <label className="flex items-center gap-2 text-small">
            <input
              type="checkbox"
              checked={visitable}
              onChange={(event) => setVisitable(event.target.checked)}
            />
            {t('filterVisitors')}
          </label>
          <label className="flex items-center gap-2 text-small">
            <input
              type="checkbox"
              checked={experience}
              onChange={(event) => setExperience(event.target.checked)}
            />
            {t('filterExperience')}
          </label>
          <label className="flex items-center gap-2 text-small">
            {t('filterCraft')}
            <select
              value={craft}
              onChange={(event) => setCraft(event.target.value)}
              className="max-w-56 rounded-input border border-ink/20 bg-surface px-2 py-1.5"
            >
              <option value="">{t('allCrafts')}</option>
              {crafts.map(({ value, category }) => (
                <option key={value} value={value}>
                  {category ? tCraft(category) : value}
                </option>
              ))}
            </select>
          </label>
          <Button
            type="button"
            variant="secondary"
            onClick={locate}
            disabled={locationState === 'locating'}
          >
            {locationState === 'locating' ? t('locating') : t('myLocation')}
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={suggestRoute}
            disabled={locationState === 'locating'}
          >
            {t('routeSuggest')}
          </Button>
          {locationState === 'denied' ? (
            <p role="status" className="text-small text-seal">
              {t('locationDenied')}
            </p>
          ) : null}
        </fieldset>

        <div className="grid gap-6 lg:grid-cols-[3fr_2fr] lg:items-start">
          {webgl === false ? (
            <p role="status" className="rounded-card border border-ink/10 p-5 text-small text-ash">
              {t('noWebgl')}
            </p>
          ) : (
            // GH#364: a labelled region, not aria-hidden, so MapLibre's own keyboard handling (focusable
            // canvas, arrow keys pan, +/- zoom) stays usable. Choosing a workshop is done from the list.
            <section
              aria-label={t('mapLabel')}
              aria-describedby="map-keyboard-hint"
              data-testid="map-frame"
              className="h-[65svh] min-h-80 overflow-hidden rounded-card shadow-warm lg:sticky lg:top-6 lg:h-[75svh]"
            >
              <p id="map-keyboard-hint" className="sr-only">
                {t('mapKeyboardHint')}
              </p>
              {webgl && !mapStarted ? <MapPlaceholder onStart={startMap} /> : null}
              {webgl && mapStarted ? (
                <MapCanvas
                  pins={filtered}
                  highlightId={highlightId}
                  selected={selected}
                  userLocation={origin}
                  route={route ? [route.start, ...route.stops] : null}
                  now={now}
                  onHighlight={setHighlightId}
                  onSelect={setSelectedId}
                  onUserMove={(next) => {
                    setBounds(next);
                    viewport.schedule(next);
                  }}
                />
              ) : null}
            </section>
          )}

          <section aria-labelledby="workshop-list-title">
            {route ? <WalkingRoutePanel route={route} now={now} onClear={clearRoute} /> : null}
            <div className="flex items-baseline justify-between gap-3">
              <h2
                id="workshop-list-title"
                className="text-h3"
                aria-live="polite"
                aria-atomic="true"
              >
                {t('listTitle', { count: listed.length })}
              </h2>
              {bounds ? (
                <button
                  type="button"
                  className="text-small text-clay underline underline-offset-4"
                  onClick={() => {
                    setBounds(null);
                    viewport.reset();
                  }}
                >
                  {t('showAll')}
                </button>
              ) : null}
            </div>
            {listed.length === 0 ? (
              <EmptyState
                className="mt-4"
                illustration="magnifier"
                title={t('empty')}
                action={
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      setOpenNow(false);
                      setVisitable(false);
                      setExperience(false);
                      setCraft('');
                      setBounds(null);
                      viewport.reset();
                    }}
                  >
                    {t('clearFilters')}
                  </Button>
                }
              />
            ) : (
              <ol className="mt-4 flex flex-col" data-testid="workshop-list">
                {listed.map((pin) => {
                  const active = highlightId === pin.workshopId;
                  return (
                    <li
                      key={pin.workshopId}
                      data-active={active || undefined}
                      className="border-ink/10 border-b px-2 py-3 last:border-b-0 data-active:bg-glaze/10"
                      onMouseEnter={() => setHighlightId(pin.workshopId)}
                      onMouseLeave={() => setHighlightId(null)}
                      onFocus={() => setHighlightId(pin.workshopId)}
                      onBlur={() => setHighlightId(null)}
                    >
                      <p className="font-medium">
                        <Link
                          href={{
                            pathname: '/nghe-nhan/[slug]',
                            params: { slug: pin.household.slug },
                          }}
                          className="hover:text-clay"
                        >
                          {pin.household.name}
                        </Link>
                      </p>
                      <p className="text-small text-ash">
                        {pin.workshopName} · {pin.address}
                      </p>
                      {craftLabel(locale, pin.household, (category) => tCraft(category)) ? (
                        <p className="text-small">
                          {craftLabel(locale, pin.household, (category) => tCraft(category))}
                        </p>
                      ) : null}
                      <p className="mt-1 flex flex-wrap items-center justify-between gap-2 text-small">
                        <OpenStatus pin={pin} now={now} />
                        {origin ? (
                          <span className="text-ash">
                            {t('distance', {
                              km: format.number(distanceKm(origin, pin), {
                                maximumFractionDigits: 1,
                              }),
                            })}
                          </span>
                        ) : null}
                      </p>
                      <ExperienceSummary pin={pin} />
                      {webgl ? (
                        <button
                          type="button"
                          aria-label={t('showOnMapNamed', { name: pin.household.name })}
                          className="mt-1 text-small text-clay underline underline-offset-4"
                          onClick={() => setSelectedId(pin.workshopId)}
                        >
                          {t('showOnMap')}
                        </button>
                      ) : null}
                    </li>
                  );
                })}
              </ol>
            )}
          </section>
        </div>
      </Reveal>
    </div>
  );
}
