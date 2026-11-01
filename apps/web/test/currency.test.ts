import { describe, expect, it } from 'vitest';
import {
  DEFAULT_USD_VND_RATE,
  parseUsdVndRate,
  showsUsdReference,
  USD_VND_RATE,
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

  it('exposes one app-wide rate', () => {
    expect(USD_VND_RATE).toBeGreaterThan(0);
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
