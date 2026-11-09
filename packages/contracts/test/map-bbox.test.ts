import { describe, expect, it } from 'vitest';
import { MapPinsQuerySchema } from '../src';

describe('MapPinsQuerySchema (FR-MAP-04)', () => {
  it('has no bbox by default', () => {
    expect(MapPinsQuerySchema.parse({})).toEqual({});
  });

  it('parses minLng,minLat,maxLng,maxLat', () => {
    expect(MapPinsQuerySchema.parse({ bbox: '105.9,20.97,105.92,20.98' })).toEqual({
      bbox: { minLng: 105.9, minLat: 20.97, maxLng: 105.92, maxLat: 20.98 },
    });
    expect(MapPinsQuerySchema.parse({ bbox: '-180,-90,180,90' }).bbox).toBeDefined();
  });

  it.each([
    'a,b,c,d',
    '1,2,3',
    '1,2,3,4,5',
    '',
    '105.9,,105.92,20.98',
    '105.92,20.97,105.9,20.98',
    '105.9,20.98,105.92,20.97',
    '105.9,20.97,105.9,20.98',
    '105.9,-90.5,105.92,20.98',
    '-181,20,105,21',
    '105.9,20.97,Infinity,21',
  ])('rejects %j', (bbox) => {
    expect(MapPinsQuerySchema.safeParse({ bbox }).success).toBe(false);
  });
});
