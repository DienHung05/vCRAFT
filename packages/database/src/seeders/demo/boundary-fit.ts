import { BAT_TRANG_BOUNDARY, type GeoPoint, isInBatTrang } from '@vcraft/domain';

/**
 * GH#396: the drawn Bát Tràng commune polygon (OpenStreetMap, post-2025 merger, roughly 7 km by 9 km) is the
 * source of truth for "in the commune". The demo workshop pins used to be drawn from a box around the old
 * village core, and 14 of the 22 landed outside the polygon, so the admin review flagged them. The seed now
 * pulls every pin that falls outside to the nearest point inside the polygon, with a small inward margin, so
 * pins keep their realistic spread and are never on the edge. The same function drives
 * `pnpm demo:refresh-coordinates`, so a live database ends up with exactly the seed's coordinates. A pin that
 * is already inside is returned unchanged, which makes both the seed and the refresh idempotent.
 */

/** Inward margin of a nudged pin, in degrees (~30 m). */
const INWARD_MARGIN = 0.0003;
const COORD_DECIMALS = 6;

const round = (value: number): number => Number(value.toFixed(COORD_DECIMALS));

/** Nearest point of the outer ring's edges to `point`, plus the unit normals of that edge (planar, lng scaled). */
function nearestOnOuterRing(point: GeoPoint): { at: GeoPoint; normals: [number, number][] } {
  const ring = BAT_TRANG_BOUNDARY[0] ?? [];
  const scale = Math.cos((point.lat * Math.PI) / 180);
  let best = { distance: Number.POSITIVE_INFINITY, at: point, normals: [] as [number, number][] };
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i] as readonly [number, number];
    const b = ring[(i + 1) % ring.length] as readonly [number, number];
    const dx = (b[0] - a[0]) * scale;
    const dy = b[1] - a[1];
    const lengthSquared = dx * dx + dy * dy;
    if (lengthSquared === 0) continue;
    const t = Math.max(
      0,
      Math.min(1, ((point.lng - a[0]) * scale * dx + (point.lat - a[1]) * dy) / lengthSquared),
    );
    const at = { lng: a[0] + (b[0] - a[0]) * t, lat: a[1] + (b[1] - a[1]) * t };
    const distance = Math.hypot((point.lng - at.lng) * scale, point.lat - at.lat);
    if (distance < best.distance) {
      const length = Math.sqrt(lengthSquared);
      best = {
        distance,
        at,
        normals: [
          [-dy / length, dx / length],
          [dy / length, -dx / length],
        ],
      };
    }
  }
  return { at: best.at, normals: best.normals };
}

/** `point`, or the nearest point inside the commune polygon (with an inward margin) when it is outside. */
export function fitInsideBoundary(point: GeoPoint): GeoPoint {
  if (isInBatTrang(point)) return point;
  const { at, normals } = nearestOnOuterRing(point);
  const scale = Math.cos((at.lat * Math.PI) / 180);
  for (let margin = INWARD_MARGIN; margin <= INWARD_MARGIN * 16; margin *= 2) {
    for (const [nx, ny] of normals) {
      const candidate = {
        lat: round(at.lat + (ny as number) * margin),
        lng: round(at.lng + ((nx as number) * margin) / scale),
      };
      if (isInBatTrang(candidate)) return candidate;
    }
  }
  throw new Error(`cannot fit (${point.lat}, ${point.lng}) inside the Bát Tràng boundary`);
}

/** Fits a pin stored as `lat`/`lng` decimal strings; returns the strings to store. */
export function fitCoordinateStrings(lat: string, lng: string): { lat: string; lng: string } {
  const fitted = fitInsideBoundary({ lat: Number(lat), lng: Number(lng) });
  if (fitted.lat === Number(lat) && fitted.lng === Number(lng)) return { lat, lng };
  return { lat: fitted.lat.toFixed(COORD_DECIMALS), lng: fitted.lng.toFixed(COORD_DECIMALS) };
}
