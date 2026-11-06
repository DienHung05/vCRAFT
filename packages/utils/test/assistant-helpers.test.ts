import { describe, expect, it } from 'vitest';
import {
  foldVietnamese,
  isAllowedLink,
  maskPii,
  normalizeUserText,
} from '../src/assistant/text-guards';
import { lunarDateOf, lunarYearName, solarToLunar } from '../src/vn/lunar-calendar';

describe('normalizeUserText', () => {
  it('folds compatibility letters and keeps Vietnamese diacritics', () => {
    expect(normalizeUserText('ｉｇｎｏｒｅ  previous')).toBe('ignore previous');
    expect(normalizeUserText('  Chào   Cáo! ')).toBe('Chào Cáo!');
  });

  it('removes zero-width, control and bidi characters', () => {
    expect(normalizeUserText('ig​nore‮ sys\u0007tem﻿')).toBe('ignore system');
  });

  it('keeps line breaks but collapses long runs', () => {
    expect(normalizeUserText('a\n\n\n\nb')).toBe('a\n\nb');
  });
});

describe('foldVietnamese', () => {
  it('matches accented, unaccented and upper-case greetings alike', () => {
    expect(foldVietnamese('Chào Cáo')).toBe('chao cao');
    expect(foldVietnamese('CHÀO CÁO')).toBe('chao cao');
    expect(foldVietnamese('Đặt hàng ở đâu?')).toBe('dat hang o dau?');
  });
});

describe('maskPii', () => {
  it('masks e-mail, Vietnamese phones and citizen ID numbers', () => {
    expect(maskPii('Mail ban@vidu.vn hoặc gọi 0912 345 678 / +84 912345678')).toBe(
      'Mail [email] hoặc gọi [phone] / [phone]',
    );
    expect(maskPii('CCCD 079203004567, số 079 203 004 567')).toBe('CCCD [cccd], số [cccd]');
  });

  it('leaves prices, years and trace codes alone', () => {
    expect(maskPii('Giá 1.250.000 đ năm 2026, mã DNENZF4C')).toBe(
      'Giá 1.250.000 đ năm 2026, mã DNENZF4C',
    );
  });
});

describe('isAllowedLink', () => {
  const origins = ['https://vcraft.vn'];

  it('allows internal paths and listed origins', () => {
    expect(isAllowedLink('/vi/yeu-cau-bao-gia/moi')).toBe(true);
    expect(isAllowedLink('https://vcraft.vn/en/products', origins)).toBe(true);
  });

  it('refuses other hosts, protocol-relative links and scripts', () => {
    expect(isAllowedLink('https://evil.test/x', origins)).toBe(false);
    expect(isAllowedLink('//evil.test/x', origins)).toBe(false);
    expect(isAllowedLink('javascript:alert(1)', origins)).toBe(false);
    expect(isAllowedLink('data:text/html,hi', origins)).toBe(false);
    expect(isAllowedLink('/\\evil.test', origins)).toBe(false);
  });
});

describe('lunar calendar', () => {
  it.each([
    // Tết Nguyên đán
    [2024, 2, 10, { day: 1, month: 1, year: 2024, leap: false }],
    [2025, 1, 29, { day: 1, month: 1, year: 2025, leap: false }],
    [2026, 2, 17, { day: 1, month: 1, year: 2026, leap: false }],
    // Last day of Ất Tỵ
    [2026, 2, 16, { day: 29, month: 12, year: 2025, leap: false }],
    // Mid-autumn 2025 (15/8)
    [2025, 10, 6, { day: 15, month: 8, year: 2025, leap: false }],
    // 2025 has a leap 6th month starting 25 Jul 2025
    [2025, 7, 25, { day: 1, month: 6, year: 2025, leap: true }],
    [2025, 6, 25, { day: 1, month: 6, year: 2025, leap: false }],
  ])('%i-%i-%i', (y, m, d, expected) => {
    expect(solarToLunar(y, m, d)).toEqual(expected);
  });

  it('reads the day in Hà Nội time', () => {
    // 17:30 UTC on 16 Feb 2026 is 00:30 on 17 Feb in Hà Nội: already Tết.
    expect(lunarDateOf(new Date('2026-02-16T17:30:00Z'))).toEqual({
      day: 1,
      month: 1,
      year: 2026,
      leap: false,
    });
  });

  it('names the year', () => {
    expect(lunarYearName(2026)).toBe('Bính Ngọ');
    expect(lunarYearName(2025)).toBe('Ất Tỵ');
    expect(lunarYearName(2024)).toBe('Giáp Thìn');
  });
});
