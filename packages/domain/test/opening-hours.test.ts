import { describe, expect, it } from 'vitest';
import {
  isValidOpeningInterval,
  type OpeningInterval,
  openState,
  workshopOpenState,
} from '../src/exhibition';

const weekdays: OpeningInterval[] = [1, 2, 3, 4, 5].map((day) => ({
  day,
  open: '08:00',
  close: '17:00',
}));

/** Giờ Việt Nam đổi sang UTC: 2026-11-02 là Thứ hai. */
const vn = (iso: string) => new Date(`${iso}+07:00`);

describe('openState (FR-ART-05)', () => {
  it('đang trong khoảng mở cửa, tính theo giờ Việt Nam', () => {
    expect(openState(weekdays, vn('2026-11-02T08:00:00'))).toEqual({
      open: true,
      closesAt: '17:00',
    });
    // 01:30 UTC Thứ hai là 08:30 Thứ hai ở Việt Nam, dù máy chủ chạy UTC
    expect(openState(weekdays, new Date('2026-11-02T01:30:00Z')).open).toBe(true);
  });

  it('đúng giờ đóng cửa là đã đóng; mở lại vào ngày làm việc kế tiếp', () => {
    expect(openState(weekdays, vn('2026-11-02T17:00:00'))).toEqual({
      open: false,
      reopens: { day: 2, at: '08:00' },
    });
  });

  it('trước giờ mở trong ngày thì mở lại ngay hôm đó', () => {
    expect(openState(weekdays, vn('2026-11-02T06:00:00'))).toEqual({
      open: false,
      reopens: { day: 1, at: '08:00' },
    });
  });

  it('cuối tuần vượt qua Chủ nhật tới Thứ hai', () => {
    expect(openState(weekdays, vn('2026-11-07T10:00:00'))).toEqual({
      open: false,
      reopens: { day: 1, at: '08:00' },
    });
  });

  it('chỉ mở một ngày trong tuần: sau giờ đóng thì đợi tuần sau', () => {
    const once = [{ day: 1, open: '08:00', close: '09:00' }];
    expect(openState(once, vn('2026-11-02T10:00:00'))).toEqual({
      open: false,
      reopens: { day: 1, at: '08:00' },
    });
  });

  it('không khai giờ thì đóng và không có giờ mở lại', () => {
    expect(openState([], vn('2026-11-02T10:00:00'))).toEqual({ open: false, reopens: null });
  });
});

describe('isValidOpeningInterval', () => {
  it('từ chối ngày sai và giờ mở sau giờ đóng', () => {
    expect(isValidOpeningInterval({ day: 7, open: '08:00', close: '17:00' })).toBe(false);
    expect(isValidOpeningInterval({ day: 1, open: '17:00', close: '08:00' })).toBe(false);
    expect(isValidOpeningInterval({ day: 1, open: '08:00', close: '17:00' })).toBe(true);
  });
});

describe('workshopOpenState', () => {
  const monday10 = vn('2026-11-02T10:00:00');

  it('follows the weekly hours when not temporarily closed', () => {
    expect(workshopOpenState({ openingHours: weekdays }, monday10)).toEqual({
      open: true,
      closesAt: '17:00',
    });
  });

  it('is never open while temporarily closed, even inside the weekly hours (BR-03)', () => {
    expect(
      workshopOpenState({ temporarilyClosed: true, openingHours: weekdays }, monday10),
    ).toEqual({
      open: false,
      reopens: null,
    });
  });

  it('is closed without hours', () => {
    expect(workshopOpenState({ openingHours: null }, monday10)).toEqual({
      open: false,
      reopens: null,
    });
  });
});
