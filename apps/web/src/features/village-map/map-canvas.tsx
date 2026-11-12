'use client';

import type { MapPinDto } from '@vcraft/contracts';
import {
  addProtocol,
  type GeoJSONSource,
  type Map as MapLibreMap,
  setWorkerUrl,
} from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useTranslations } from 'next-intl';
import { Protocol } from 'pmtiles';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import MapGL, {
  AttributionControl,
  Layer,
  type MapLayerMouseEvent,
  type MapRef,
  Marker,
  Popup,
  Source,
  type ViewStateChangeEvent,
} from 'react-map-gl/maplibre';
import {
  type LatLng,
  type MapBounds,
  type PinStatus,
  toFeatureCollection,
  villageCenter,
} from './map-model';
import { PMTILES_URL } from './offline-style';
import { loadPinImage, PIN_COLORS, PIN_HEIGHT, PIN_WIDTH, pinSvg } from './pin-icons';
import { PinPopup } from './pin-popup';
import { pulseDue, pulsePaint, shouldPulse } from './pin-pulse';
import {
  avoidObstacle,
  CARD_ESTIMATE,
  type PopupAnchor,
  panToFit,
  popupAnchorFor,
  popupOffsetFor,
  unionBox,
} from './popup-fit';
import { useMapStyle } from './use-map-style';
import { routeLine } from './walking-route';

// Tệp này do `scripts/copy-map-worker.mjs` chép vào `public/map` khi dev và build.
setWorkerUrl('/map/maplibre-gl-worker.mjs');
// `pmtiles://` URLs of the offline Bát Tràng extract (GH#100), registered once per page.
if (PMTILES_URL) addProtocol('pmtiles', new Protocol().tile);

const SOURCE = 'workshops';
const CLUSTERS = 'workshop-clusters';
const PINS = 'workshop-pins';
const ROUTE_SOURCE = 'walking-route';
const GLAZE = '#2f6f6a';
const PAPER = '#fbf7ef';
const PHONE = '(max-width: 639px)';
/** The selected pin is drawn 1.3 times its size (see the `icon-size` of the pins layer). */
const SELECTED_PIN_HEIGHT = Math.round(PIN_HEIGHT * 1.3);
const SELECTED_PIN_WIDTH = Math.round(PIN_WIDTH * 1.3);
const POPUP_GAP = 4;
/** Room kept between the info card and the map's edges when the map is panned to show it (GH#475). */
const POPUP_PADDING = 12;

/** Marker bitmaps by image id, shared by every map on the page and kept across style switches. */
const pinImages = new Map<string, HTMLImageElement>();

/** Adds a pin image the style asks for; cached bitmaps go in at once, others once decoded (GH#216). */
function providePinImage(map: MapLibreMap, id: string) {
  if (map.hasImage(id)) return;
  const cached = pinImages.get(id);
  if (cached) {
    map.addImage(id, cached, { pixelRatio: 2 });
    return;
  }
  void loadPinImage(id)?.then((image) => {
    pinImages.set(id, image);
    if (!map.hasImage(id)) map.addImage(id, image, { pixelRatio: 2 });
  });
}

function usePhone(): boolean {
  const [phone, setPhone] = useState(false);
  useEffect(() => {
    const list = window.matchMedia(PHONE);
    const update = () => setPhone(list.matches);
    update();
    list.addEventListener('change', update);
    return () => list.removeEventListener('change', update);
  }, []);
  return phone;
}

export interface MapCanvasProps {
  pins: readonly MapPinDto[];
  highlightId: string | null;
  selected: MapPinDto | null;
  userLocation: LatLng | null;
  /** Walking route to draw: the start followed by the stops in order (FR-MAP-08). */
  route?: readonly LatLng[] | null;
  now: Date;
  onHighlight: (id: string | null) => void;
  onSelect: (id: string | null) => void;
  /** Chỉ gọi khi người dùng tự kéo/thu phóng, để trình đọc màn hình luôn nhận đủ danh sách. */
  onUserMove: (bounds: MapBounds) => void;
}

/** Bản đồ MapLibre (FR-MAP-01, 04): nạp riêng phía trình duyệt vì cần WebGL. */
export default function MapCanvas({
  pins,
  highlightId,
  selected,
  userLocation,
  route = null,
  now,
  onHighlight,
  onSelect,
  onUserMove,
}: MapCanvasProps) {
  const t = useTranslations('villageMap');
  const mapRef = useRef<MapRef>(null);
  const { style, offline, onMapError } = useMapStyle();
  const data = useMemo(() => toFeatureCollection(pins, now), [pins, now]);
  const initialCenter = useMemo(() => {
    const { lat, lng } = villageCenter();
    return { longitude: lng, latitude: lat };
  }, []);
  const routeData = useMemo(
    () => (route && route.length > 1 ? routeLine(route[0] as LatLng, route.slice(1)) : null),
    [route],
  );

  const phone = usePhone();
  const selectedId = selected?.workshopId ?? '';
  const hasOpenPin = useMemo(() => data.features.some((pin) => pin.properties.open), [data]);
  const icons = useMemo(
    () => [...new Set(data.features.map((pin) => pin.properties.icon))],
    [data],
  );
  const [container, setContainer] = useState<HTMLElement | null>(null);

  // The phone bottom sheet is flagged on the root element so the Fox assistant steps aside (GH#297).
  const sheetOpen = Boolean(selected && phone);
  useEffect(() => {
    if (!sheetOpen) return;
    document.documentElement.dataset.mapSheet = 'open';
    return () => {
      delete document.documentElement.dataset.mapSheet;
    };
  }, [sheetOpen]);

  // Pin images: the ones in use now, and any the style asks for later (a style switch drops them).
  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (!map || !container) return;
    for (const id of icons) providePinImage(map, id);
    const onMissing = (event: { id: string }) => providePinImage(map, event.id);
    map.on('styleimagemissing', onMissing);
    return () => {
      map.off('styleimagemissing', onMissing);
    };
  }, [icons, container]);

  // Esc closes the info card, as the close button and a tap on the map do.
  useEffect(() => {
    if (!selected) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onSelect(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selected, onSelect]);
  const [inView, setInView] = useState(true);

  // MapLibre opens the compact attribution until the first move; on a phone that wide strip would cover
  // the legend and the pins, so it starts as the small "i" button (GH#475). Tapping it still opens it.
  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (!map || !container || !phone) return;
    // `idle`: the style's attributions are in and the control has turned compact by then.
    const collapse = () => {
      const attribution = container.querySelector('.maplibregl-ctrl-attrib');
      attribution?.removeAttribute('open');
      attribution?.classList.remove('maplibregl-compact-show');
    };
    map.once('idle', collapse);
    return () => {
      map.off('idle', collapse);
    };
  }, [container, phone]);

  // Which side of the pin the info card opens on (GH#475): decided once per selection, from where the pin
  // is on screen, so the card opens below a pin near the top edge and inwards near the sides. The card is
  // only mounted once this is known, so it never flips after it appears.
  const selectedLng = selected?.lng;
  const selectedLat = selected?.lat;
  const [placement, setPlacement] = useState<{ id: string; anchor: PopupAnchor } | null>(null);
  useLayoutEffect(() => {
    if (!selectedId || selectedLng === undefined || selectedLat === undefined || phone) return;
    const map = mapRef.current?.getMap();
    // Wait for the map to load (`container` is set then): before that the pin has no screen position,
    // and a card opened on a guessed side hung cut off by the frame until the load (GH#475).
    if (!map || !container) return;
    const anchor = popupAnchorFor(
      map.project([selectedLng, selectedLat]),
      { width: container.clientWidth, height: container.clientHeight },
      CARD_ESTIMATE,
      SELECTED_PIN_HEIGHT,
    );
    setPlacement({ id: selectedId, anchor });
  }, [selectedId, selectedLng, selectedLat, phone, container]);
  const popupAnchor = placement?.id === selectedId ? placement.anchor : null;

  // Once the card is laid out, pan the map when part of it (or of its pin) is still outside the map, for
  // a card taller than the map (a short phone in landscape) or a pin that was off screen when picked from
  // the list. A jump, not a glide, for people who asked for reduced motion.
  const popupReady = popupAnchor !== null;
  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (!map || !container || !popupReady || selectedLng === undefined || selectedLat === undefined)
      return;
    const frame = requestAnimationFrame(() => {
      const card = container.querySelector('.maplibregl-popup')?.getBoundingClientRect();
      if (!card) return;
      const mapBox = container.getBoundingClientRect();
      const point = map.project([selectedLng, selectedLat]);
      const x = mapBox.left + point.x;
      const y = mapBox.top + point.y;
      const pinBox = {
        left: x - SELECTED_PIN_WIDTH / 2,
        right: x + SELECTED_PIN_WIDTH / 2,
        top: y - SELECTED_PIN_HEIGHT,
        bottom: y,
      };
      const withPin = unionBox(card, pinBox);
      // When card and pin together do not fit the map, the card (photo and name first) wins.
      const fits = withPin.bottom - withPin.top <= mapBox.height - 2 * POPUP_PADDING;
      const fitOffset = panToFit(fits ? withPin : card, mapBox, POPUP_PADDING);
      // Keep the pin out from under the legend: a pin under it cannot be grabbed or tapped.
      const legend = container.querySelector('[data-testid="map-legend"]')?.getBoundingClientRect();
      const offset = avoidObstacle(
        fitOffset,
        pinBox,
        card,
        legend
          ? { left: legend.left, top: legend.top, right: legend.right, bottom: legend.bottom }
          : null,
        mapBox,
        POPUP_PADDING,
      );
      if (offset.x === 0 && offset.y === 0) return;
      const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      map.panBy([offset.x, offset.y], { animate: !reducedMotion, duration: 250 });
    });
    return () => cancelAnimationFrame(frame);
  }, [container, popupReady, selectedLng, selectedLat]);

  useEffect(() => {
    if (!container || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(([entry]) =>
      setInView(entry?.isIntersecting ?? true),
    );
    observer.observe(container);
    return () => observer.disconnect();
  }, [container]);

  // Nhịp thở của ghim đang mở (FR-MAP-03): tắt hẳn khi người dùng giảm chuyển động. Every update
  // redraws the whole map, so it is throttled and paused while nobody can see it (GH#144).
  useEffect(() => {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!shouldPulse({ reducedMotion, inView, hasOpenPin })) return;
    let frame = 0;
    let lastDrawn: number | null = null;
    const tick = (time: number) => {
      const map = mapRef.current?.getMap();
      if (map?.getLayer('workshop-pulse') && pulseDue(time, lastDrawn)) {
        lastDrawn = time;
        const { radius, opacity } = pulsePaint(time);
        map.setPaintProperty('workshop-pulse', 'circle-radius', radius);
        map.setPaintProperty('workshop-pulse', 'circle-opacity', opacity);
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [inView, hasOpenPin]);

  // Frame the whole route; no animation for people who asked for reduced motion.
  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (!map || !container || !route || route.length < 2) return;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const lngs = route.map((point) => point.lng);
    const lats = route.map((point) => point.lat);
    map.fitBounds(
      [
        [Math.min(...lngs), Math.min(...lats)],
        [Math.max(...lngs), Math.max(...lats)],
      ],
      { padding: 48, maxZoom: 17, animate: !reducedMotion },
    );
  }, [route, container]);

  const handleClick = async (event: MapLayerMouseEvent) => {
    const feature = event.features?.[0];
    if (!feature) {
      onSelect(null);
      return;
    }
    if (feature.layer.id === CLUSTERS && feature.geometry.type === 'Point') {
      const map = mapRef.current?.getMap();
      const source = map?.getSource(SOURCE) as GeoJSONSource | undefined;
      const clusterId = feature.properties?.cluster_id as number | undefined;
      if (!map || !source || clusterId === undefined) return;
      const zoom = await source.getClusterExpansionZoom(clusterId);
      const [longitude = 0, latitude = 0] = feature.geometry.coordinates;
      map.easeTo({ center: [longitude, latitude], zoom });
      return;
    }
    onSelect((feature.properties?.id as string | undefined) ?? null);
  };

  const handleMoveEnd = (event: ViewStateChangeEvent) => {
    if (!('originalEvent' in event) || !event.originalEvent) return;
    const bounds = event.target.getBounds();
    onUserMove({
      west: bounds.getWest(),
      south: bounds.getSouth(),
      east: bounds.getEast(),
      north: bounds.getNorth(),
    });
  };

  // While the online style is being probed, keep the map's box empty rather than flash an error.
  if (!style) return null;

  return (
    <MapGL
      ref={mapRef}
      mapStyle={style}
      onError={onMapError}
      onLoad={(event) => setContainer(event.target.getContainer())}
      initialViewState={
        selected
          ? { longitude: selected.lng, latitude: selected.lat, zoom: 16 }
          : { ...initialCenter, zoom: 14 }
      }
      style={{ width: '100%', height: '100%' }}
      interactiveLayerIds={[CLUSTERS, PINS]}
      cursor={highlightId ? 'pointer' : 'grab'}
      onClick={(event) => void handleClick(event)}
      onMouseMove={(event) => {
        const feature = event.features?.[0];
        onHighlight(
          feature?.layer.id === PINS ? ((feature.properties?.id as string) ?? null) : null,
        );
      }}
      onMoveEnd={handleMoveEnd}
      // Compact, in the bottom-left corner: the Fox launcher sits over the bottom-right one (GH#475).
      attributionControl={false}
    >
      <AttributionControl position="bottom-left" compact />
      <Source id={SOURCE} type="geojson" data={data} cluster clusterRadius={44} clusterMaxZoom={16}>
        <Layer
          id={CLUSTERS}
          type="circle"
          filter={['has', 'point_count']}
          // Brand-coloured count badges (GH#216); a tap zooms into the cluster.
          paint={{
            'circle-color': PIN_COLORS.open,
            'circle-radius': ['step', ['get', 'point_count'], 18, 5, 22, 15, 28],
            'circle-stroke-color': PAPER,
            'circle-stroke-width': 3,
          }}
        />
        <Layer
          id="workshop-cluster-count"
          type="symbol"
          filter={['has', 'point_count']}
          layout={{
            'text-field': ['get', 'point_count_abbreviated'],
            'text-font': ['Noto Sans Regular'],
            'text-size': 15,
          }}
          paint={{ 'text-color': PAPER }}
        />
        <Layer
          id="workshop-pulse"
          type="circle"
          filter={['all', ['!', ['has', 'point_count']], ['==', ['get', 'open'], true]]}
          paint={{
            'circle-color': GLAZE,
            'circle-radius': 12,
            'circle-opacity': 0.2,
            // The pulse loop sets these itself; MapLibre's default 300 ms transition would keep
            // redrawing between its throttled updates (GH#144).
            'circle-radius-transition': { duration: 0, delay: 0 },
            'circle-opacity-transition': { duration: 0, delay: 0 },
          }}
        />
        {/* Marker pins coloured by status with a purpose glyph (GH#216); the selected one grows and rises. */}
        <Layer
          id={PINS}
          type="symbol"
          filter={['!', ['has', 'point_count']]}
          layout={{
            'icon-image': ['get', 'icon'],
            'icon-anchor': 'bottom',
            'icon-allow-overlap': true,
            'icon-ignore-placement': true,
            'icon-size': [
              'case',
              ['==', ['get', 'id'], selectedId],
              1.3,
              ['==', ['get', 'id'], highlightId ?? ''],
              1.15,
              1,
            ],
            'symbol-sort-key': [
              'case',
              ['==', ['get', 'id'], selectedId],
              2,
              ['==', ['get', 'id'], highlightId ?? ''],
              1,
              0,
            ],
          }}
        />
      </Source>
      {routeData ? (
        <Source id={ROUTE_SOURCE} type="geojson" data={routeData}>
          <Layer
            id="walking-route-line"
            type="line"
            layout={{ 'line-cap': 'round', 'line-join': 'round' }}
            paint={{
              'line-color': PIN_COLORS.open,
              'line-width': 4,
              'line-dasharray': [2, 1.5],
            }}
          />
        </Source>
      ) : null}
      {userLocation ? (
        <Marker longitude={userLocation.lng} latitude={userLocation.lat}>
          <span className="block size-4 rounded-full border-2 border-paper bg-seal shadow-warm" />
        </Marker>
      ) : null}
      {selected && !phone && popupAnchor ? (
        <Popup
          longitude={selected.lng}
          latitude={selected.lat}
          anchor={popupAnchor}
          offset={popupOffsetFor(popupAnchor, SELECTED_PIN_HEIGHT, POPUP_GAP)}
          maxWidth="18rem"
          closeOnClick={false}
          onClose={() => onSelect(null)}
        >
          <PinPopup pin={selected} now={now} />
        </Popup>
      ) : null}
      {selected && phone ? (
        // Phones: a bottom sheet over the map instead of a popup that would cover the pin.
        <div
          data-testid="pin-sheet"
          className="absolute inset-x-0 bottom-0 z-10 max-h-[90%] overflow-y-auto rounded-t-card bg-surface p-4 shadow-warm"
        >
          <PinPopup pin={selected} now={now} onClose={() => onSelect(null)} />
        </div>
      ) : (
        <MapLegend />
      )}
      {offline ? (
        <p className="absolute top-2 left-2 rounded-chip bg-surface/90 px-2 py-1 text-small text-ash shadow-warm">
          {t('offline')}
        </p>
      ) : null}
    </MapGL>
  );
}

const LEGEND: readonly {
  status: PinStatus;
  key: 'legendOpen' | 'legendClosed' | 'legendProduction';
}[] = [
  { status: 'open', key: 'legendOpen' },
  { status: 'closed', key: 'legendClosed' },
  { status: 'production', key: 'legendProduction' },
];

/** What the pin colours mean (GH#216), in the map's bottom-left corner, just above the attribution (GH#475). */
function MapLegend() {
  const t = useTranslations('villageMap');
  return (
    <div
      data-testid="map-legend"
      className="absolute bottom-12 left-2.5 rounded-input bg-surface/95 px-3 py-2 text-small shadow-warm"
    >
      <p className="sr-only">{t('legendTitle')}</p>
      <ul className="flex flex-col gap-1">
        {LEGEND.map(({ status, key }) => (
          <li key={status} className="flex items-center gap-2">
            {/* biome-ignore lint/performance/noImgElement: a tiny inline SVG swatch, nothing to optimise. */}
            <img
              src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(pinSvg(status, 'SHOWROOM'))}`}
              alt=""
              width={PIN_WIDTH / 2}
              height={PIN_HEIGHT / 2}
            />
            {t(key)}
          </li>
        ))}
      </ul>
    </div>
  );
}
