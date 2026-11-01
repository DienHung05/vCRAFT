'use client';

import { setWorkerUrl } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import MapGL, { Marker } from 'react-map-gl/maplibre';

// Tệp này do `scripts/copy-map-worker.mjs` chép vào `public/map` khi dev và build.
setWorkerUrl('/map/maplibre-gl-worker.mjs');

const STYLE_URL =
  process.env.NEXT_PUBLIC_MAP_STYLE_URL || 'https://tiles.openfreemap.org/styles/liberty';

/** Bấm trên bản đồ để chọn vị trí xưởng (FR-ART-05); nạp riêng phía trình duyệt vì cần WebGL. */
export default function WorkshopMapPicker({
  lat,
  lng,
  onPick,
  label,
}: {
  lat: number | null;
  lng: number | null;
  onPick: (lat: number, lng: number) => void;
  /** Accessible name of the map region; pages with several maps need distinct names (WCAG 1.3.1). */
  label?: string;
}) {
  return (
    <MapGL
      mapStyle={STYLE_URL}
      {...(label ? { locale: { 'Map.Title': label } } : {})}
      initialViewState={{ longitude: lng ?? 105.9139, latitude: lat ?? 20.9758, zoom: 14 }}
      style={{ width: '100%', height: '100%' }}
      cursor="crosshair"
      onClick={(event) => onPick(event.lngLat.lat, event.lngLat.lng)}
    >
      {lat !== null && lng !== null ? (
        <Marker longitude={lng} latitude={lat}>
          <span className="block size-4 rounded-full border-2 border-paper bg-seal shadow-warm" />
        </Marker>
      ) : null}
    </MapGL>
  );
}
