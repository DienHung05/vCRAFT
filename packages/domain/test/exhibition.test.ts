import { describe, expect, it } from 'vitest';
import { checkMakerCredits, isVisitable, splitWorkshops } from '../src';

describe('tách nơi đón khách khỏi xưởng sản xuất', () => {
  it('chỉ phòng trưng bày (hoặc vừa làm vừa trưng bày) đang nhận khách là nơi thăm được', () => {
    expect(isVisitable({ purpose: 'SHOWROOM', acceptsVisitors: true })).toBe(true);
    expect(isVisitable({ purpose: 'BOTH', acceptsVisitors: true })).toBe(true);
    expect(isVisitable({ purpose: 'SHOWROOM', acceptsVisitors: false })).toBe(false);
    // Xưởng sản xuất không bao giờ là điểm thăm, kể cả khi lỡ bật nhận khách
    expect(isVisitable({ purpose: 'PRODUCTION', acceptsVisitors: true })).toBe(false);
  });

  it('chia danh sách và giữ thứ tự', () => {
    const ws = [
      { id: 'a', purpose: 'PRODUCTION', acceptsVisitors: false },
      { id: 'b', purpose: 'SHOWROOM', acceptsVisitors: true },
      { id: 'c', purpose: 'BOTH', acceptsVisitors: false },
      { id: 'd', purpose: 'BOTH', acceptsVisitors: true },
    ] as const;
    const { showrooms, production } = splitWorkshops(ws);
    expect(showrooms.map((w) => w.id)).toEqual(['b', 'd']);
    expect(production.map((w) => w.id)).toEqual(['a', 'c']);
  });
});

describe('ghi công người làm', () => {
  const household = new Set(['binh', 'lan']);

  it('ghi công từng nghệ nhân của hộ, mỗi người một lần', () => {
    expect(
      checkMakerCredits(
        [
          { artisanId: 'binh', contribution: 'Vuốt dáng' },
          { artisanId: 'lan', contribution: 'Vẽ lam' },
        ],
        household,
      ).ok,
    ).toBe(true);
  });

  it.each([
    [[], 'MAKER_REQUIRED'],
    [[{ artisanId: 'nguoi-ngoai', contribution: 'Nung' }], 'MAKER_NOT_IN_HOUSEHOLD'],
    [
      [
        { artisanId: 'binh', contribution: 'Vuốt dáng' },
        { artisanId: 'binh', contribution: 'Nung' },
      ],
      'MAKER_DUPLICATED',
    ],
  ] as const)('từ chối %j ⇒ %s', (credits, code) => {
    const result = checkMakerCredits(credits, household);
    expect(result.ok ? undefined : result.error.code).toBe(code);
  });
});
