'use client';

import type { WorkshopDto } from '@vcraft/contracts';
import { setWorkerUrl } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import MapGL, { Marker } from 'react-map-gl/maplibre';

// Tệp này do `scripts/copy-map-worker.mjs` chép vào `public/map` khi dev và build.
setWorkerUrl('/map/maplibre-gl-worker.mjs');

const STYLE_URL =
  process.env.NEXT_PUBLIC_MAP_STYLE_URL || 'https://tiles.openfreemap.org/styles/liberty';

/** Vị trí các xưởng hộ khai, để đối chiếu khi duyệt (FR-ADM-02). */
export default function WorkshopReviewMap({ workshops }: { workshops: readonly WorkshopDto[] }) {
  const located = workshops.flatMap((w) =>
    w.lat !== null && w.lng !== null ? [{ id: w.id, lat: w.lat, lng: w.lng }] : [],
  );
  const first = located[0];
  return (
    <MapGL
      mapStyle={STYLE_URL}
      initialViewState={{
        longitude: first?.lng ?? 105.9139,
        latitude: first?.lat ?? 20.9758,
        zoom: 14,
      }}
      style={{ width: '100%', height: '100%' }}
    >
      {located.map((w) => (
        <Marker key={w.id} longitude={w.lng} latitude={w.lat}>
          <span className="block size-4 rounded-full border-2 border-paper bg-seal shadow-warm" />
        </Marker>
      ))}
    </MapGL>
  );
}
