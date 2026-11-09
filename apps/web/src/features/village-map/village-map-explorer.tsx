'use client';

import type { MapPinDto } from '@vcraft/contracts';
import { Button } from '@vcraft/ui';
import dynamic from 'next/dynamic';
import { useFormatter, useLocale, useTranslations } from 'next-intl';
import { useEffect, useMemo, useState } from 'react';
import { EmptyState } from '@/components/states/empty-state';
import { Reveal } from '@/experience/motion/reveal';
import { craftLabel } from '@/features/catalog/craft-label';
import { Link } from '@/i18n/navigation';
import { useUntabbable } from '@/lib/a11y/use-untabbable';
import {
  craftsOf,
  distanceKm,
  filterPins,
  inBounds,
  type LatLng,
  type MapBounds,
  sortByDistance,
} from './map-model';
import { ExperienceSummary, OpenStatus } from './pin-popup';

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

/**
 * Bản đồ làng và danh sách xưởng đồng bộ hai chiều (FR-MAP-01…07). Danh sách luôn nằm trong trang,
 * nên không có WebGL hay dùng trình đọc màn hình vẫn đọc được đủ xưởng; chỉ khi người dùng tự kéo
 * bản đồ thì danh sách mới thu theo khung nhìn, và có nút trả lại toàn bộ.
 */
export function VillageMapExplorer({
  pins,
  initialSelectedId,
}: {
  pins: readonly MapPinDto[];
  /** Workshop whose card is open when the page loads (`/ban-do?xuong=`). */
  initialSelectedId?: string;
}) {
  const t = useTranslations('villageMap');
  const tCraft = useTranslations('catalog.craftCategories');
  const locale = useLocale();
  const format = useFormatter();
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
    initialSelectedId && pins.some((pin) => pin.workshopId === initialSelectedId)
      ? initialSelectedId
      : null,
  );
  const [origin, setOrigin] = useState<LatLng | null>(null);
  const [locationState, setLocationState] = useState<LocationState>('idle');
  // The map frame is aria-hidden (the list beside it is the accessible equivalent), so nothing inside
  // it may take focus.
  const frame = useUntabbable<HTMLDivElement>(webgl);

  useEffect(() => {
    setWebgl(supportsWebGL());
    setNow(new Date());
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const crafts = useMemo(() => craftsOf(pins), [pins]);
  const filtered = useMemo(
    () => filterPins(pins, { openNow, visitable, experience, craft }, now),
    [pins, openNow, visitable, experience, craft, now],
  );
  const listed = useMemo(() => {
    const inView = bounds ? filtered.filter((pin) => inBounds(pin, bounds)) : filtered;
    return origin ? sortByDistance(inView, origin) : inView;
  }, [filtered, bounds, origin]);
  const selected = filtered.find((pin) => pin.workshopId === selectedId) ?? null;

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
              {crafts.map((name) => (
                <option key={name} value={name}>
                  {name}
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
            // Bản đồ chỉ là minh họa thêm; nội dung tương đương nằm trong danh sách bên cạnh.
            <div
              ref={frame}
              aria-hidden="true"
              data-testid="map-frame"
              className="h-[55svh] min-h-80 overflow-hidden rounded-card shadow-warm lg:sticky lg:top-6 lg:h-[75svh]"
            >
              {webgl ? (
                <MapCanvas
                  pins={filtered}
                  highlightId={highlightId}
                  selected={selected}
                  userLocation={origin}
                  now={now}
                  onHighlight={setHighlightId}
                  onSelect={setSelectedId}
                  onUserMove={setBounds}
                />
              ) : null}
            </div>
          )}

          <section aria-labelledby="workshop-list-title">
            <div className="flex items-baseline justify-between gap-3">
              <h2 id="workshop-list-title" className="text-h3">
                {t('listTitle', { count: listed.length })}
              </h2>
              {bounds ? (
                <button
                  type="button"
                  className="text-small text-clay underline underline-offset-4"
                  onClick={() => setBounds(null)}
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
                          aria-hidden="true"
                          tabIndex={-1}
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
