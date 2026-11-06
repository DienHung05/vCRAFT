import { describe, expect, it } from 'vitest';
import { BAT_TRANG_BOUNDARY, isInBatTrang, pointInPolygon, type Ring } from '../src/village';

// A 2x2 square with a 1x1 hole in the corner, [lng, lat].
const SQUARE: Ring = [
  [0, 0],
  [2, 0],
  [2, 2],
  [0, 2],
  [0, 0],
];
const HOLE: Ring = [
  [1, 1],
  [2, 1],
  [2, 2],
  [1, 2],
  [1, 1],
];

describe('pointInPolygon', () => {
  it('is true inside and false outside', () => {
    expect(pointInPolygon({ lng: 0.5, lat: 0.5 }, [SQUARE])).toBe(true);
    expect(pointInPolygon({ lng: 3, lat: 0.5 }, [SQUARE])).toBe(false);
    expect(pointInPolygon({ lng: -0.1, lat: 1 }, [SQUARE])).toBe(false);
  });

  it('counts the edge and the vertices as inside', () => {
    expect(pointInPolygon({ lng: 0, lat: 1 }, [SQUARE])).toBe(true);
    expect(pointInPolygon({ lng: 1, lat: 2 }, [SQUARE])).toBe(true);
    expect(pointInPolygon({ lng: 2, lat: 2 }, [SQUARE])).toBe(true);
  });

  it('excludes holes but keeps their edge', () => {
    expect(pointInPolygon({ lng: 1.5, lat: 1.5 }, [SQUARE, HOLE])).toBe(false);
    expect(pointInPolygon({ lng: 1, lat: 1.5 }, [SQUARE, HOLE])).toBe(true);
  });

  it('accepts an open ring', () => {
    expect(pointInPolygon({ lng: 1, lat: 1 }, [SQUARE.slice(0, 4)])).toBe(true);
  });
});

describe('isInBatTrang', () => {
  it('ships a closed ring', () => {
    const outer = BAT_TRANG_BOUNDARY[0] ?? [];
    expect(outer.length).toBeGreaterThan(10);
    expect(outer[0]).toEqual(outer.at(-1));
  });

  it('accepts the village core', () => {
    // Bát Tràng ceramic market, and a riverside hamlet north of it.
    expect(isInBatTrang({ lat: 20.9765, lng: 105.9135 })).toBe(true);
    expect(isInBatTrang({ lat: 20.9818, lng: 105.9173 })).toBe(true);
  });

  it('flags places outside the commune', () => {
    // Just across the provincial line in Phụng Công (Hưng Yên), ~700 m south of the market.
    expect(isInBatTrang({ lat: 20.9712, lng: 105.9153 })).toBe(false);
    // Hoàn Kiếm Lake, central Hà Nội.
    expect(isInBatTrang({ lat: 21.0287, lng: 105.8524 })).toBe(false);
    // Hồ Chí Minh City.
    expect(isInBatTrang({ lat: 10.7769, lng: 106.7009 })).toBe(false);
  });
});
