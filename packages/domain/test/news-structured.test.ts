import { describe, expect, it } from 'vitest';
import {
  activeOutages,
  materialPriceSeries,
  type Outage,
  outageAudience,
  outageReachesHousehold,
  outagesOn,
  villageTimeOfDay,
  villageToday,
} from '../src/news/structured';
import { isVillageAreaCode, OUTAGE_AREA_CODES, VILLAGE_AREA_CODES } from '../src/village/areas';

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

describe('villageTimeOfDay', () => {
  it('uses Hà Nội time on a 24-hour clock, with midnight as 00:00', () => {
    expect(villageTimeOfDay(new Date('2026-11-02T20:00:00Z'))).toBe('03:00');
    expect(villageTimeOfDay(new Date('2026-11-02T17:00:00Z'))).toBe('00:00');
    expect(villageTimeOfDay(new Date('2026-11-02T16:59:59Z'))).toBe('23:59');
  });
});

describe('village areas', () => {
  it('lists the hamlets and adds the whole-commune audience for notices', () => {
    expect(VILLAGE_AREA_CODES).toEqual(['BAT_TRANG', 'GIANG_CAO']);
    expect(OUTAGE_AREA_CODES).toEqual(['BAT_TRANG', 'GIANG_CAO', 'VILLAGE_WIDE']);
    expect(isVillageAreaCode('GIANG_CAO')).toBe(true);
    // The whole commune is an audience, not a place a workshop can be.
    expect(isVillageAreaCode('VILLAGE_WIDE')).toBe(false);
    expect(isVillageAreaCode('Giang Cao')).toBe(false);
  });
});

describe('outage audience (ADR-0023)', () => {
  const cut = (areaCode?: Outage['areaCode']): Outage => ({
    date: '2026-11-09',
    from: '08:00',
    to: '11:30',
    area: 'Xóm 2',
    ...(areaCode && { areaCode }),
  });

  it('treats a legacy cut without an area code as village-wide, never mapping its free text', () => {
    expect(outageAudience(cut())).toBe('VILLAGE_WIDE');
    // The free text says Giang Cao, but without a code the cut still warns everyone.
    const legacy: Outage = { ...cut(), area: 'Thôn Giang Cao' };
    expect(outageReachesHousehold(legacy, ['BAT_TRANG'])).toBe(true);
  });

  it('warns a household when a workshop is in the cut area and spares the others', () => {
    expect(outageReachesHousehold(cut('GIANG_CAO'), ['GIANG_CAO'])).toBe(true);
    expect(outageReachesHousehold(cut('GIANG_CAO'), ['BAT_TRANG'])).toBe(false);
  });

  it('warns a household with several workshops when any of them is in the area', () => {
    expect(outageReachesHousehold(cut('GIANG_CAO'), ['BAT_TRANG', 'GIANG_CAO'])).toBe(true);
    expect(outageReachesHousehold(cut('BAT_TRANG'), ['BAT_TRANG', 'GIANG_CAO'])).toBe(true);
    expect(outageReachesHousehold(cut('GIANG_CAO'), ['BAT_TRANG', 'BAT_TRANG'])).toBe(false);
  });

  it('warns every household about a village-wide cut', () => {
    expect(outageReachesHousehold(cut('VILLAGE_WIDE'), ['BAT_TRANG'])).toBe(true);
    expect(outageReachesHousehold(cut('VILLAGE_WIDE'), [])).toBe(true);
  });

  it('warns a household whose workshops have no area (or that has no workshop) about every cut', () => {
    expect(outageReachesHousehold(cut('GIANG_CAO'), [])).toBe(true);
    expect(outageReachesHousehold(cut('BAT_TRANG'), [null])).toBe(true);
    expect(outageReachesHousehold(cut('BAT_TRANG'), [null, undefined])).toBe(true);
  });

  it('lets one workshop with an area narrow a household that has another without one', () => {
    expect(outageReachesHousehold(cut('GIANG_CAO'), ['BAT_TRANG', null])).toBe(false);
    expect(outageReachesHousehold(cut('BAT_TRANG'), ['BAT_TRANG', null])).toBe(true);
  });
});

describe('activeOutages time window (ADR-0023)', () => {
  const schedule = {
    outages: [{ date: '2026-11-09', from: '08:00', to: '11:30', area: 'Xóm 2' }],
  };
  // Village time is UTC+7: 2026-11-09 00:00 in Hà Nội is 2026-11-08T17:00:00Z.
  const at = (utc: string) => activeOutages([schedule], new Date(utc), []).length;

  it('is hidden before the village date starts', () => {
    expect(at('2026-11-08T16:59:59Z')).toBe(0); // 23:59:59 on 8 Nov
  });

  it('starts at 00:00 of the village date, well before the cut (the advance warning)', () => {
    expect(at('2026-11-08T17:00:00Z')).toBe(1); // 00:00 on 9 Nov
    expect(at('2026-11-09T00:59:00Z')).toBe(1); // 07:59, a minute before the cut
  });

  it('stays during the cut up to its last minute', () => {
    expect(at('2026-11-09T01:00:00Z')).toBe(1); // 08:00
    expect(at('2026-11-09T04:29:59Z')).toBe(1); // 11:29:59
  });

  it('disappears at the end time and stays gone for the rest of the day', () => {
    expect(at('2026-11-09T04:30:00Z')).toBe(0); // 11:30
    expect(at('2026-11-09T09:00:00Z')).toBe(0); // 16:00
    expect(at('2026-11-09T16:59:59Z')).toBe(0); // 23:59:59 on 9 Nov
  });

  it('is gone on the next village date', () => {
    expect(at('2026-11-09T17:00:00Z')).toBe(0); // 00:00 on 10 Nov
  });

  it('uses the village date, not the UTC date, around midnight', () => {
    const lateCut = {
      outages: [{ date: '2026-11-09', from: '23:00', to: '23:59', area: 'Xóm 2' }],
    };
    // 22:30 UTC on 8 Nov is already 05:30 on 9 Nov in the village.
    expect(activeOutages([lateCut], new Date('2026-11-08T22:30:00Z'), [])).toHaveLength(1);
    // 16:30 UTC on 9 Nov is 23:30 on 9 Nov: still within the cut.
    expect(activeOutages([lateCut], new Date('2026-11-09T16:30:00Z'), [])).toHaveLength(1);
    // 17:00 UTC on 9 Nov is 00:00 on 10 Nov: a new village date.
    expect(activeOutages([lateCut], new Date('2026-11-09T17:00:00Z'), [])).toHaveLength(0);
  });

  it('applies the audience together with the window, and lets an administrator (null) see all', () => {
    const mixed = {
      outages: [
        {
          date: '2026-11-09',
          from: '13:00',
          to: '15:00',
          area: 'A',
          areaCode: 'GIANG_CAO' as const,
        },
        {
          date: '2026-11-09',
          from: '08:00',
          to: '09:00',
          area: 'B',
          areaCode: 'BAT_TRANG' as const,
        },
        { date: '2026-11-09', from: '10:00', to: '11:00', area: 'C' },
      ],
    };
    const now = new Date('2026-11-09T00:00:00Z'); // 07:00 in the village
    expect(activeOutages([mixed], now, ['GIANG_CAO']).map((o) => o.area)).toEqual(['C', 'A']);
    expect(activeOutages([mixed], now, ['BAT_TRANG']).map((o) => o.area)).toEqual(['B', 'C']);
    expect(activeOutages([mixed], now, []).map((o) => o.area)).toEqual(['B', 'C', 'A']);
    expect(activeOutages([mixed], now, null).map((o) => o.area)).toEqual(['B', 'C', 'A']);
    // After B ended (09:00) it drops out, the others stay.
    const later = new Date('2026-11-09T03:00:00Z'); // 10:00
    expect(activeOutages([mixed], later, null).map((o) => o.area)).toEqual(['C', 'A']);
  });
});
