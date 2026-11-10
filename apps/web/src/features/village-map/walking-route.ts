import { distanceKm, type LatLng } from './map-model';

/** A walk past more workshops than this stops being a short suggestion (FR-MAP-08). */
export const MAX_ROUTE_STOPS = 8;

/**
 * Nearest-neighbour order: from `start`, always walk to the closest workshop not yet visited. Not the
 * shortest possible tour, but short and predictable. Stops beyond `limit` are dropped.
 */
export function nearestNeighbourOrder<T extends LatLng>(
  start: LatLng,
  stops: readonly T[],
  limit = MAX_ROUTE_STOPS,
): T[] {
  const remaining = [...stops];
  const ordered: T[] = [];
  let here = start;
  while (remaining.length > 0 && ordered.length < limit) {
    let nearest = 0;
    let best = Number.POSITIVE_INFINITY;
    remaining.forEach((stop, index) => {
      const km = distanceKm(here, stop);
      if (km < best) {
        best = km;
        nearest = index;
      }
    });
    const [next] = remaining.splice(nearest, 1);
    if (!next) break;
    ordered.push(next);
    here = next;
  }
  return ordered;
}

/** Walking length (km, as the crow flies) of the legs start → stop 1 → stop 2 → ... */
export function routeLengthKm(start: LatLng, ordered: readonly LatLng[]): number {
  let total = 0;
  let here = start;
  for (const stop of ordered) {
    total += distanceKm(here, stop);
    here = stop;
  }
  return total;
}

/** GeoJSON line through the start and the stops, for the map's route layer. */
export function routeLine(start: LatLng, ordered: readonly LatLng[]) {
  return {
    type: 'Feature' as const,
    properties: {},
    geometry: {
      type: 'LineString' as const,
      coordinates: [start, ...ordered].map((point) => [point.lng, point.lat]),
    },
  };
}
