import { describe, expect, it } from 'vitest';
import { materialPriceSeries, outagesOn, villageToday } from '../src/news/structured';

const notice = (effectiveOn: string, clay: number, gas?: number) => ({
  effectiveOn,
  prices: [
    { material: 'CLAY' as const, unit: 'tấn', priceVnd: clay },
    ...(gas ? [{ material: 'GAS' as const, unit: 'bình 12 kg', priceVnd: gas }] : []),
  ],
});

describe('materialPriceSeries', () => {
  it('gives one point per month for the last six months, carrying the price in force', () => {
    const series = materialPriceSeries(
      [
        notice('2026-06-03', 1_000_000, 400_000),
        notice('2026-08-15', 1_100_000),
        notice('2026-10-01', 1_150_000),
      ],
      '2026-11-03',
    );
    expect(series.map((s) => s.material)).toEqual(['CLAY', 'GAS']);
    expect(series[0]).toEqual({
      material: 'CLAY',
      unit: 'tấn',
      points: [
        { month: '2026-06', priceVnd: 1_000_000 },
        { month: '2026-07', priceVnd: 1_000_000 },
        { month: '2026-08', priceVnd: 1_100_000 },
        { month: '2026-09', priceVnd: 1_100_000 },
        { month: '2026-10', priceVnd: 1_150_000 },
        { month: '2026-11', priceVnd: 1_150_000 },
      ],
    });
    expect(series[1]?.points.every((p) => p.priceVnd === 400_000)).toBe(true);
  });

  it('leaves out months before the first known price and crosses a year boundary', () => {
    const [clay] = materialPriceSeries([notice('2026-12-20', 900_000)], '2027-02-01', 6);
    expect(clay?.points.map((p) => p.month)).toEqual(['2026-12', '2027-01', '2027-02']);
  });

  it('is empty with no notices', () => {
    expect(materialPriceSeries([], '2026-11-03')).toEqual([]);
  });
});

describe('outagesOn', () => {
  it('keeps only the given day, earliest first', () => {
    const outages = outagesOn(
      [
        { outages: [{ date: '2026-11-03', from: '13:00', to: '17:00', area: 'Xóm 3' }] },
        {
          outages: [
            { date: '2026-11-03', from: '07:30', to: '11:00', area: 'Giang Cao' },
            { date: '2026-11-04', from: '08:00', to: '10:00', area: 'Kim Lan' },
          ],
        },
      ],
      '2026-11-03',
    );
    expect(outages.map((o) => o.area)).toEqual(['Giang Cao', 'Xóm 3']);
  });
});

describe('villageToday', () => {
  it('uses Hà Nội time', () => {
    // 20:00 UTC on 2 Nov is 03:00 on 3 Nov in Hà Nội.
    expect(villageToday(new Date('2026-11-02T20:00:00Z'))).toBe('2026-11-03');
  });
});
