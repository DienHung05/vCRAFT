import boundary from './bat-trang-boundary.json';

/** A WGS84 point as the API stores workshop pins. */
export interface GeoPoint {
  lat: number;
  lng: number;
}

/** A closed ring of `[lng, lat]` positions, GeoJSON order. */
export type Ring = readonly (readonly [number, number])[];

// Tolerance for "on the edge", in degrees (~1 cm): a pin placed on the drawn boundary counts as inside.
const EDGE_EPSILON = 1e-7;

function onSegment(
  x: number,
  y: number,
  a: readonly [number, number],
  b: readonly [number, number],
) {
  const [ax, ay] = a;
  const [bx, by] = b;
  const cross = (bx - ax) * (y - ay) - (by - ay) * (x - ax);
  const length = Math.hypot(bx - ax, by - ay);
  if (Math.abs(cross) > EDGE_EPSILON * Math.max(length, 1)) return false;
  return (
    x >= Math.min(ax, bx) - EDGE_EPSILON &&
    x <= Math.max(ax, bx) + EDGE_EPSILON &&
    y >= Math.min(ay, by) - EDGE_EPSILON &&
    y <= Math.max(ay, by) + EDGE_EPSILON
  );
}

/**
 * Whether `point` lies inside `ring` or on its edge (even-odd ray casting). The ring may be closed
 * (first position repeated last) or open.
 */
export function pointInRing(point: GeoPoint, ring: Ring): boolean {
  const { lng: x, lat: y } = point;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i] as readonly [number, number];
    const b = ring[j] as readonly [number, number];
    if (onSegment(x, y, a, b)) return true;
    const [ax, ay] = a;
    const [bx, by] = b;
    if (ay > y !== by > y && x < ((bx - ax) * (y - ay)) / (by - ay) + ax) inside = !inside;
  }
  return inside;
}

/** Inside the outer ring and outside every hole of a GeoJSON polygon. */
export function pointInPolygon(point: GeoPoint, polygon: readonly Ring[]): boolean {
  const [outer, ...holes] = polygon;
  if (!outer || !pointInRing(point, outer)) return false;
  return !holes.some((hole) => pointInRing(point, hole) && !onAnyEdge(point, hole));
}

function onAnyEdge(point: GeoPoint, ring: Ring): boolean {
  return ring.some((a, i) => onSegment(point.lng, point.lat, a, ring[(i + 1) % ring.length] ?? a));
}

/**
 * The boundary of Bát Tràng commune (Hà Nội) after the July 2025 merger, from OpenStreetMap (ODbL,
 * see `bat-trang-boundary.json` for the source and simplification). PLAN E2.
 */
export const BAT_TRANG_BOUNDARY = boundary.features[0]?.geometry
  .coordinates as unknown as readonly Ring[];

/**
 * Whether a workshop pin lies in Bát Tràng. A pin outside is not rejected: registration and the admin
 * review only flag it, because the village's outer hamlets and showrooms can sit on the line.
 */
export function isInBatTrang(point: GeoPoint): boolean {
  return pointInPolygon(point, BAT_TRANG_BOUNDARY);
}
