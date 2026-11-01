import { describe, expect, it } from 'vitest';
import {
  DEFAULT_USD_VND_RATE,
  FALLBACK_USD_RATE,
  isPlausibleUsdVndRate,
  parseUsdRatePayload,
  parseUsdVndRate,
  showsUsdReference,
  usdFractionDigits,
  vndToUsd,
} from '@/lib/currency';

describe('USD reference rate', () => {
  it('uses the configured rate when it is a positive number', () => {
    expect(parseUsdVndRate('26000')).toBe(26_000);
    expect(parseUsdVndRate(' 24500.5 ')).toBe(24_500.5);
  });

  it('falls back to the default for anything else', () => {
    for (const raw of [undefined, '', '  ', 'abc', '0', '-5', 'Infinity']) {
      expect(parseUsdVndRate(raw), String(raw)).toBe(DEFAULT_USD_VND_RATE);
    }
  });

  it('exposes an undated fallback rate', () => {
    expect(FALLBACK_USD_RATE.rate).toBeGreaterThan(0);
    expect(FALLBACK_USD_RATE.asOf).toBeNull();
  });
});

describe('isPlausibleUsdVndRate', () => {
  it('accepts rates in the sane range and rejects the rest', () => {
    expect(isPlausibleUsdVndRate(25_765)).toBe(true);
    expect(isPlausibleUsdVndRate(10_000)).toBe(true);
    expect(isPlausibleUsdVndRate(60_000)).toBe(true);
    for (const value of [0, -1, 9_999, 60_001, 0.000039, Number.NaN, Infinity, '25000', null]) {
      expect(isPlausibleUsdVndRate(value), String(value)).toBe(false);
    }
  });
});

describe('parseUsdRatePayload', () => {
  it('reads the dated VND rate and rounds it to a whole dong', () => {
    expect(parseUsdRatePayload({ date: '2026-10-31', usd: { vnd: 25765.52073557 } })).toEqual({
      rate: 25_766,
      asOf: '2026-10-31',
    });
  });

  it('rejects malformed or implausible payloads', () => {
    const bad: unknown[] = [
      null,
      'text',
      [],
      {},
      { date: '2026-10-31' },
      { date: '2026-10-31', usd: {} },
      { date: '2026-10-31', usd: { vnd: '25765' } },
      { date: '2026-10-31', usd: { vnd: 0 } },
      { date: '2026-10-31', usd: { vnd: 1.5 } },
      { date: '2026-10-31', usd: { vnd: 25_765_000 } },
      { date: 'yesterday', usd: { vnd: 25_765 } },
      { date: '2026-13-45', usd: { vnd: 25_765 } },
      { usd: { vnd: 25_765 } },
    ];
    for (const payload of bad) {
      expect(parseUsdRatePayload(payload), JSON.stringify(payload)).toBeNull();
    }
  });
});

describe('vndToUsd', () => {
  it('divides by the rate', () => {
    expect(vndToUsd(250_000, 25_000)).toBe(10);
    expect(vndToUsd(1_250_000, 25_000)).toBe(50);
    expect(vndToUsd(0, 25_000)).toBe(0);
  });
});

describe('usdFractionDigits', () => {
  it('keeps cents only for small amounts', () => {
    expect(usdFractionDigits(0.8)).toBe(2);
    expect(usdFractionDigits(9.99)).toBe(2);
    expect(usdFractionDigits(10)).toBe(0);
    expect(usdFractionDigits(1250)).toBe(0);
  });
});

describe('showsUsdReference', () => {
  it('is for the English site only', () => {
    expect(showsUsdReference('en')).toBe(true);
    expect(showsUsdReference('vi')).toBe(false);
  });
});
