import { type MapPinDto, MapPinsResponseSchema } from '@vcraft/contracts';
import { type OpenState, openState } from '@vcraft/domain';
import { apiBaseUrl } from '@/features/news/news-api';

export type MapPinsResult = { status: 'ok'; pins: MapPinDto[] } | { status: 'unavailable' };

/** Ghim xưởng từ `GET /map/workshops`; API tắt hoặc trả sai dạng thì trang hiện lỗi kèm thử lại. */
export async function fetchMapPins(): Promise<MapPinsResult> {
  try {
    const res = await fetch(`${apiBaseUrl()}/map/workshops`, {
      headers: { accept: 'application/json' },
      next: { revalidate: 30 },
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return { status: 'unavailable' };
    const parsed = MapPinsResponseSchema.safeParse(await res.json());
    return parsed.success ? { status: 'ok', pins: parsed.data.data } : { status: 'unavailable' };
  } catch {
    return { status: 'unavailable' };
  }
}

export interface LatLng {
  lat: number;
  lng: number;
}

export interface MapBounds {
  west: number;
  south: number;
  east: number;
  north: number;
}

export interface MapFilters {
  openNow: boolean;
  visitable: boolean;
  /** Nghề được chọn; chuỗi rỗng là mọi nghề. */
  craft: string;
}

/** Xưởng không khai giờ thì không báo "đang mở" (đóng, không có giờ mở lại). */
export const pinOpenState = (pin: MapPinDto, now: Date): OpenState =>
  openState(pin.openingHours ?? [], now);

export function filterPins(
  pins: readonly MapPinDto[],
  filters: MapFilters,
  now: Date,
): MapPinDto[] {
  return pins.filter(
    (pin) =>
      (!filters.openNow || pinOpenState(pin, now).open) &&
      (!filters.visitable || pin.visitable) &&
      (filters.craft === '' || pin.household.craft === filters.craft),
  );
}

/** Danh sách nghề để lọc, không trùng, theo thứ tự tiếng Việt. */
export function craftsOf(pins: readonly MapPinDto[]): string[] {
  const crafts = new Set(pins.flatMap((p) => (p.household.craft ? [p.household.craft] : [])));
  return [...crafts].sort((a, b) => a.localeCompare(b, 'vi'));
}

export const inBounds = (pin: LatLng, b: MapBounds): boolean =>
  pin.lat >= b.south && pin.lat <= b.north && pin.lng >= b.west && pin.lng <= b.east;

const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

/** Khoảng cách đường chim bay (haversine), km. */
export function distanceKm(a: LatLng, b: LatLng): number {
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(a.lat)) * Math.cos(toRadians(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

export function sortByDistance(pins: readonly MapPinDto[], origin: LatLng): MapPinDto[] {
  return [...pins].sort((a, b) => distanceKm(origin, a) - distanceKm(origin, b));
}

/** Dữ liệu GeoJSON cho nguồn MapLibre có gom cụm; `open` điều khiển lớp nhịp thở của ghim mở. */
export function toFeatureCollection(pins: readonly MapPinDto[], now: Date) {
  return {
    type: 'FeatureCollection' as const,
    features: pins.map((pin) => ({
      type: 'Feature' as const,
      geometry: { type: 'Point' as const, coordinates: [pin.lng, pin.lat] },
      properties: { id: pin.workshopId, open: pinOpenState(pin, now).open },
    })),
  };
}
