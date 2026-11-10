import { isInBatTrang } from '@vcraft/domain';
import { describe, expect, it } from 'vitest';
import { fitCoordinateStrings, fitInsideBoundary } from '../src/seeders/demo/boundary-fit';

describe('fitInsideBoundary (GH#396)', () => {
  it('leaves a pin that is already inside untouched', () => {
    const inside = { lat: 20.9758, lng: 105.9139 };
    expect(isInBatTrang(inside)).toBe(true);
    expect(fitInsideBoundary(inside)).toBe(inside);
  });

  it('pulls the reported outside pin (gom-thu-hang) inside, close to where it was', () => {
    const pin = { lat: 20.96987, lng: 105.913705 };
    expect(isInBatTrang(pin)).toBe(false);
    const fitted = fitInsideBoundary(pin);
    expect(isInBatTrang(fitted)).toBe(true);
    expect(Math.hypot(fitted.lat - pin.lat, fitted.lng - pin.lng)).toBeLessThan(0.01);
  });

  it('fits every point of the box the seed draws from, and a second pass changes nothing', () => {
    for (let i = 0; i <= 24; i++) {
      for (let j = 0; j <= 24; j++) {
        const lat = (20.9758 + (i / 24 - 0.5) * 0.012).toFixed(6);
        const lng = (105.9139 + (j / 24 - 0.1) * 0.009).toFixed(6);
        const fitted = fitCoordinateStrings(lat, lng);
        expect(isInBatTrang({ lat: Number(fitted.lat), lng: Number(fitted.lng) })).toBe(true);
        expect(fitCoordinateStrings(fitted.lat, fitted.lng)).toEqual(fitted);
      }
    }
  });
});
