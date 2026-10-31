'use client';

import 'maplibre-gl/dist/maplibre-gl.css';
import { SealMark } from '@vcraft/ui';
import { type StyleSpecification, setWorkerUrl } from 'maplibre-gl';
import { useEffect, useRef } from 'react';
import MapGL, { type MapRef, Marker, NavigationControl } from 'react-map-gl/maplibre';

// MapLibre 6 tự đoán URL worker từ vị trí tệp của chính nó, mà bundler đổi tên/gộp tệp nên đoán trượt
// ("Worker failed to load"). Khai báo thẳng: bundler sao tệp worker (tự chứa, không import thêm) thành asset.
setWorkerUrl(new URL('maplibre-gl/dist/maplibre-gl-worker.mjs', import.meta.url).href);

export interface Coordinates {
  lat: number;
  lng: number;
}

/**
 * Nền bản đồ tối giản cho bước chọn vị trí: gạch raster OpenStreetMap (dùng nhẹ, có ghi nguồn).
 * Style giấy dó + PMTiles của bản đồ làng (BRAND §9, `NEXT_PUBLIC_MAP_STYLE_URL`) thuộc trang
 * `/ban-do`; khi trang đó có style dùng chung thì thay hằng này.
 */
const OSM_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      maxzoom: 19,
      attribution: '© OpenStreetMap',
    },
  },
  layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
};

/** Tâm mặc định: `NEXT_PUBLIC_MAP_CENTER` ("kinh độ,vĩ độ"), hoặc Bát Tràng. */
function defaultCenter(): Coordinates {
  const [lng, lat] = (process.env.NEXT_PUBLIC_MAP_CENTER ?? '').split(',').map(Number);
  return Number.isFinite(lng) && Number.isFinite(lat)
    ? { lng: lng as number, lat: lat as number }
    : { lng: 105.9139, lat: 20.9758 };
}

export interface LocationMapProps {
  value: Coordinates | null;
  onPick: (coordinates: Coordinates) => void;
  /** WebGL hoặc tải style thất bại: cha chuyển sang chỉ nhập tọa độ. */
  onFailure: () => void;
  label: string;
  markerLabel: string;
}

const round6 = (n: number) => Math.round(n * 1e6) / 1e6;

/** Bản đồ MapLibre chọn vị trí xưởng: nhấp để đặt ghim, kéo ghim để tinh chỉnh. */
export default function LocationMap({
  value,
  onPick,
  onFailure,
  label,
  markerLabel,
}: LocationMapProps) {
  const map = useRef<MapRef>(null);
  const start = value ?? defaultCenter();

  // Tọa độ gõ tay hoặc lấy từ GPS thì đưa bản đồ tới đó.
  const lat = value?.lat;
  const lng = value?.lng;
  useEffect(() => {
    if (lat === undefined || lng === undefined) return;
    map.current?.easeTo({ center: [lng, lat], duration: 400 });
  }, [lat, lng]);

  return (
    <div
      role="application"
      aria-label={label}
      className="h-72 overflow-hidden rounded-card ring-1 ring-ink/10 md:h-96"
    >
      <MapGL
        ref={map}
        initialViewState={{ longitude: start.lng, latitude: start.lat, zoom: value ? 16 : 14 }}
        mapStyle={OSM_STYLE}
        cursor="crosshair"
        onClick={(event) =>
          onPick({ lat: round6(event.lngLat.lat), lng: round6(event.lngLat.lng) })
        }
        // Lỗi một viên gạch bản đồ không đáng bỏ cả bản đồ; chỉ lỗi khởi tạo (WebGL, style) mới chuyển sang nhập tay.
        onError={(event) => {
          if (!(event as { sourceId?: string }).sourceId) onFailure();
        }}
        style={{ width: '100%', height: '100%' }}
      >
        <NavigationControl showCompass={false} />
        {value ? (
          <Marker
            longitude={value.lng}
            latitude={value.lat}
            anchor="bottom"
            draggable
            onDragEnd={(event) =>
              onPick({ lat: round6(event.lngLat.lat), lng: round6(event.lngLat.lng) })
            }
          >
            <SealMark size={34} title={markerLabel} />
          </Marker>
        ) : null}
      </MapGL>
    </div>
  );
}
