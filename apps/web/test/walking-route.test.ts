import { describe, expect, it } from 'vitest';
import {
  MAX_ROUTE_STOPS,
  nearestNeighbourOrder,
  routeLengthKm,
  routeLine,
} from '@/features/village-map/walking-route';

const at = (id: string, lat: number, lng: number) => ({ id, lat, lng });

describe('nearestNeighbourOrder (FR-MAP-08)', () => {
  const start = { lat: 20.97, lng: 105.91 };

  it('walks to the closest unvisited stop each time', () => {
    const a = at('a', 20.971, 105.91);
    const b = at('b', 20.975, 105.91);
    const c = at('c', 20.98, 105.91);
    expect(nearestNeighbourOrder(start, [c, a, b]).map((s) => s.id)).toEqual(['a', 'b', 'c']);
  });

  it('starts from the nearest stop, not the first in the input', () => {
    const near = at('near', 20.9705, 105.91);
    const far = at('far', 20.99, 105.91);
    expect(nearestNeighbourOrder(start, [far, near]).map((s) => s.id)).toEqual(['near', 'far']);
  });

  it('returns nothing for no stops and does not mutate the input', () => {
    expect(nearestNeighbourOrder(start, [])).toEqual([]);
    const stops = [at('x', 21, 106), at('y', 20.971, 105.91)];
    nearestNeighbourOrder(start, stops);
    expect(stops.map((s) => s.id)).toEqual(['x', 'y']);
  });

  it('keeps a short walk: at most MAX_ROUTE_STOPS stops', () => {
    const many = Array.from({ length: 20 }, (_, i) => at(`s${i}`, 20.97 + i * 0.001, 105.91));
    expect(nearestNeighbourOrder(start, many)).toHaveLength(MAX_ROUTE_STOPS);
    expect(nearestNeighbourOrder(start, many, 3)).toHaveLength(3);
  });
});

describe('route geometry', () => {
  const start = { lat: 20.97, lng: 105.91 };
  const stops = [at('a', 20.971, 105.91), at('b', 20.972, 105.91)];

  it('sums the legs in km', () => {
    expect(routeLengthKm(start, [])).toBe(0);
    expect(routeLengthKm(start, stops)).toBeCloseTo(0.222, 2);
  });

  it('draws a GeoJSON line in lng,lat order from the start through every stop', () => {
    expect(routeLine(start, stops).geometry.coordinates).toEqual([
      [105.91, 20.97],
      [105.91, 20.971],
      [105.91, 20.972],
    ]);
  });
});
