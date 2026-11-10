import { describe, expect, it } from 'vitest';
import { liveShares } from '../src';

const share = (status: string, quantity: number) => ({ status, quantity });

describe('liveShares (GH#416)', () => {
  it('drops cancelled shares', () => {
    expect(liveShares([share('DONE', 5), share('CANCELLED', 5)])).toEqual([share('DONE', 5)]);
  });

  it('drops a declined share whose quantity was reallocated', () => {
    expect(liveShares([share('DONE', 5), share('DECLINED', 0)])).toEqual([share('DONE', 5)]);
  });

  it('keeps a declined share that still holds quantity', () => {
    expect(liveShares([share('DECLINED', 3)])).toEqual([share('DECLINED', 3)]);
  });

  it('keeps every other status', () => {
    const all = ['PROPOSED', 'CONFIRMED', 'IN_PROGRESS', 'DONE'].map((s) => share(s, 1));
    expect(liveShares(all)).toEqual(all);
  });

  it('returns an empty list for no shares', () => {
    expect(liveShares([])).toEqual([]);
  });
});
