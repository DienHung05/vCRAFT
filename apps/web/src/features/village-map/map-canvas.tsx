'use client';

import type { MapPinDto } from '@vcraft/contracts';
import { addProtocol, type GeoJSONSource, setWorkerUrl } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useTranslations } from 'next-intl';
import { Protocol } from 'pmtiles';
import { useEffect, useMemo, useRef } from 'react';
import MapGL, {
  Layer,
  type MapLayerMouseEvent,
  type MapRef,
  Marker,
  Popup,
  Source,
  type ViewStateChangeEvent,
} from 'react-map-gl/maplibre';
import { type LatLng, type MapBounds, toFeatureCollection } from './map-model';
import { PMTILES_URL } from './offline-style';
import { PinPopup } from './pin-popup';
import { useMapStyle } from './use-map-style';

// Tệp này do `scripts/copy-map-worker.mjs` chép vào `public/map` khi dev và build.
setWorkerUrl('/map/maplibre-gl-worker.mjs');
// `pmtiles://` URLs of the offline Bát Tràng extract (GH#100), registered once per page.
if (PMTILES_URL) addProtocol('pmtiles', new Protocol().tile);

const SOURCE = 'workshops';
const CLUSTERS = 'workshop-clusters';
const PINS = 'workshop-pins';
const CLAY = '#a4532a';
const GLAZE = '#2f6f6a';
const INK = '#2a2622';

export interface MapCanvasProps {
  pins: readonly MapPinDto[];
  highlightId: string | null;
  selected: MapPinDto | null;
  userLocation: LatLng | null;
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
    const [lng = 105.9139, lat = 20.9758] = (process.env.NEXT_PUBLIC_MAP_CENTER ?? '')
      .split(',')
      .map((value) => Number.parseFloat(value))
      .filter(Number.isFinite);
    return { longitude: lng, latitude: lat };
  }, []);

  // Nhịp thở của ghim đang mở (FR-MAP-03): tắt hẳn khi người dùng giảm chuyển động.
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let frame = 0;
    const tick = (time: number) => {
      const map = mapRef.current?.getMap();
      if (map?.getLayer('workshop-pulse')) {
        const phase = (time % 2000) / 2000;
        map.setPaintProperty('workshop-pulse', 'circle-radius', 8 + phase * 14);
        map.setPaintProperty('workshop-pulse', 'circle-opacity', 0.45 * (1 - phase));
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

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
      initialViewState={{ ...initialCenter, zoom: 14 }}
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
    >
      <Source id={SOURCE} type="geojson" data={data} cluster clusterRadius={44} clusterMaxZoom={16}>
        <Layer
          id={CLUSTERS}
          type="circle"
          filter={['has', 'point_count']}
          paint={{
            'circle-color': INK,
            'circle-radius': ['step', ['get', 'point_count'], 16, 5, 20, 15, 26],
            'circle-stroke-color': '#fff',
            'circle-stroke-width': 2,
          }}
        />
        <Layer
          id="workshop-cluster-count"
          type="symbol"
          filter={['has', 'point_count']}
          layout={{
            'text-field': ['get', 'point_count_abbreviated'],
            'text-font': ['Noto Sans Regular'],
            'text-size': 13,
          }}
          paint={{ 'text-color': '#fff' }}
        />
        <Layer
          id="workshop-pulse"
          type="circle"
          filter={['all', ['!', ['has', 'point_count']], ['==', ['get', 'open'], true]]}
          paint={{ 'circle-color': GLAZE, 'circle-radius': 12, 'circle-opacity': 0.2 }}
        />
        <Layer
          id={PINS}
          type="circle"
          filter={['!', ['has', 'point_count']]}
          paint={{
            'circle-color': ['case', ['==', ['get', 'open'], true], GLAZE, CLAY],
            'circle-radius': ['case', ['==', ['get', 'id'], highlightId ?? ''], 11, 7],
            'circle-stroke-color': '#fff',
            'circle-stroke-width': ['case', ['==', ['get', 'id'], highlightId ?? ''], 3, 2],
          }}
        />
      </Source>
      {userLocation ? (
        <Marker longitude={userLocation.lng} latitude={userLocation.lat}>
          <span className="block size-4 rounded-full border-2 border-paper bg-seal shadow-warm" />
        </Marker>
      ) : null}
      {selected ? (
        <Popup
          longitude={selected.lng}
          latitude={selected.lat}
          offset={14}
          maxWidth="17rem"
          onClose={() => onSelect(null)}
        >
          <PinPopup pin={selected} now={now} />
        </Popup>
      ) : null}
      {offline ? (
        <p className="absolute top-2 left-2 rounded-chip bg-surface/90 px-2 py-1 text-small text-ash shadow-warm">
          {t('offline')}
        </p>
      ) : null}
    </MapGL>
  );
}
