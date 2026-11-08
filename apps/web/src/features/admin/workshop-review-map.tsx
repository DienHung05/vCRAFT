'use client';

import type { WorkshopDto } from '@vcraft/contracts';
import { BAT_TRANG_BOUNDARY } from '@vcraft/domain';
import { setWorkerUrl } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useMemo } from 'react';
import MapGL, { Layer, Marker, Source } from 'react-map-gl/maplibre';

// Tệp này do `scripts/copy-map-worker.mjs` chép vào `public/map` khi dev và build.
setWorkerUrl('/map/maplibre-gl-worker.mjs');

const STYLE_URL =
  process.env.NEXT_PUBLIC_MAP_STYLE_URL || 'https://tiles.openfreemap.org/styles/liberty';

// Match the village map color and keep the boundary lighter than the workshop pins.
const GLAZE = '#2f6f6a';

const BOUNDARY_SOURCE = 'bat-trang-boundary';

const BOUNDARY_FILL = {
  id: 'bat-trang-boundary-fill',
  type: 'fill',
  paint: { 'fill-color': GLAZE, 'fill-opacity': 0.12 },
} as const;

const BOUNDARY_OUTLINE = {
  id: 'bat-trang-boundary-outline',
  type: 'line',
  paint: { 'line-color': GLAZE, 'line-width': 2 },
} as const;

/** GeoJSON polygon of Bát Tràng built from the existing `@vcraft/domain` boundary; every ring (outer
 * ring and holes) is kept, positions stay in GeoJSON `[lng, lat]` order. */
function boundaryFeatureCollection() {
  return {
    type: 'FeatureCollection' as const,
    features: [
      {
        type: 'Feature' as const,
        properties: {},
        geometry: {
          type: 'Polygon' as const,
          coordinates: BAT_TRANG_BOUNDARY.map((ring) => ring.map(([lng, lat]) => [lng, lat])),
        },
      },
    ],
  };
}

/** Smallest `[west, south], [east, north]` box around the village boundary and every located pin, so
 * the first view shows the polygon even when the first workshop sits outside the village. */
function viewBoundsOf(located: readonly { lat: number; lng: number }[]) {
  const lngs: number[] = [];
  const lats: number[] = [];
  for (const ring of BAT_TRANG_BOUNDARY) {
    for (const [lng, lat] of ring) {
      lngs.push(lng);
      lats.push(lat);
    }
  }
  for (const pin of located) {
    lngs.push(pin.lng);
    lats.push(pin.lat);
  }
  if (lngs.length === 0) return null;
  return [
    [Math.min(...lngs), Math.min(...lats)],
    [Math.max(...lngs), Math.max(...lats)],
  ] as [[number, number], [number, number]];
}

/** Workshop pins declared by the household, to check against the village boundary while reviewing
 * (FR-ADM-02); Bát Tràng itself is drawn as a filled, outlined background layer. */
export default function WorkshopReviewMap({ workshops }: { workshops: readonly WorkshopDto[] }) {
  const located = workshops.flatMap((w) =>
    w.lat !== null && w.lng !== null ? [{ id: w.id, lat: w.lat, lng: w.lng }] : [],
  );
  const first = located[0];
  const boundaryData = useMemo(boundaryFeatureCollection, []);
  const viewBounds = viewBoundsOf(located);
  return (
    <MapGL
      mapStyle={STYLE_URL}
      initialViewState={
        viewBounds
          ? { bounds: viewBounds, fitBoundsOptions: { padding: 24, maxZoom: 15 } }
          : {
              longitude: first?.lng ?? 105.9139,
              latitude: first?.lat ?? 20.9758,
              zoom: 14,
            }
      }
      style={{ width: '100%', height: '100%' }}
    >
      <Source id={BOUNDARY_SOURCE} type="geojson" data={boundaryData}>
        <Layer {...BOUNDARY_FILL} />
        <Layer {...BOUNDARY_OUTLINE} />
      </Source>
      {located.map((w) => (
        <Marker key={w.id} longitude={w.lng} latitude={w.lat}>
          <span className="block size-4 rounded-full border-2 border-paper bg-seal shadow-warm" />
        </Marker>
      ))}
    </MapGL>
  );
}
