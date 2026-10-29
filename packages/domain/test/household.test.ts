import { describe, expect, it } from 'vitest';
import {
  HOUSEHOLD_EVENTS,
  HOUSEHOLD_STATUSES,
  type HouseholdEvent,
  type HouseholdStatus,
  householdStructuralNext,
  householdTransition,
  isHouseholdPublic,
  PRODUCT_STATUSES,
  type ProductContext,
  productTransition,
  publicProductAvailability,
} from '../src';

const EXPECTED: Record<HouseholdStatus, Partial<Record<HouseholdEvent, HouseholdStatus>>> = {
  PENDING_REVIEW: { APPROVE: 'APPROVED', REJECT: 'REJECTED' },
  APPROVED: { SUSPEND: 'SUSPENDED' },
  SUSPENDED: { REINSTATE: 'APPROVED' },
  REJECTED: {},
};

describe('Household state machine', () => {
  describe.each(HOUSEHOLD_STATUSES)('từ %s', (state) => {
    it.each(HOUSEHOLD_EVENTS)('sự kiện %s đúng bảng', (event) => {
      const expected = EXPECTED[state][event];
      const result = householdStructuralNext(state, event);
      expect(result.ok ? result.value : undefined).toBe(expected);
    });
  });

  it('chỉ Quản trị viên làng được duyệt hộ', () => {
    const r = householdTransition('PENDING_REVIEW', 'APPROVE', { actorRole: 'HOUSEHOLD' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('FORBIDDEN_ACTOR');
    expect(householdTransition('PENDING_REVIEW', 'APPROVE', { actorRole: 'ADMIN' })).toEqual({
      ok: true,
      value: 'APPROVED',
    });
  });

  it('tạm ngừng và từ chối bắt buộc có lý do', () => {
    for (const [from, event] of [
      ['APPROVED', 'SUSPEND'],
      ['PENDING_REVIEW', 'REJECT'],
    ] as const) {
      const missing = householdTransition(from, event, { actorRole: 'ADMIN', reason: '  ' });
      expect(missing.ok).toBe(false);
      if (!missing.ok) expect(missing.error.code).toBe('REASON_REQUIRED');
      expect(householdTransition(from, event, { actorRole: 'ADMIN', reason: 'Hồ sơ sai' }).ok).toBe(
        true,
      );
    }
  });

  it('chỉ hộ APPROVED có hiện diện công khai', () => {
    expect(HOUSEHOLD_STATUSES.filter(isHouseholdPublic)).toEqual(['APPROVED']);
  });
});

describe('Product publication', () => {
  const owner: ProductContext = {
    actorRole: 'HOUSEHOLD',
    isOwner: true,
    householdStatus: 'APPROVED',
  };

  it('người đại diện hộ đã duyệt xuất bản được sản phẩm của mình', () => {
    expect(productTransition('DRAFT', 'PUBLISH', owner)).toEqual({ ok: true, value: 'PUBLISHED' });
  });

  it('hộ chưa duyệt hoặc đang tạm ngừng không xuất bản được', () => {
    for (const householdStatus of ['PENDING_REVIEW', 'SUSPENDED', 'REJECTED'] as const) {
      const r = productTransition('DRAFT', 'PUBLISH', { ...owner, householdStatus });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error.code).toBe('HOUSEHOLD_NOT_APPROVED');
    }
  });

  it('hộ khác và Ban quản lý không xuất bản thay', () => {
    expect(productTransition('DRAFT', 'PUBLISH', { ...owner, isOwner: false }).ok).toBe(false);
    expect(productTransition('DRAFT', 'PUBLISH', { ...owner, actorRole: 'ADMIN' }).ok).toBe(false);
  });

  it('rút sản phẩm cần lý do; chủ hộ hoặc Ban quản lý đều rút được', () => {
    const noReason = productTransition('PUBLISHED', 'WITHDRAW', owner);
    expect(noReason.ok).toBe(false);
    if (!noReason.ok) expect(noReason.error.code).toBe('REASON_REQUIRED');
    expect(productTransition('PUBLISHED', 'WITHDRAW', { ...owner, reason: 'Hỏng' }).ok).toBe(true);
    expect(
      productTransition('PUBLISHED', 'WITHDRAW', {
        actorRole: 'ADMIN',
        isOwner: false,
        householdStatus: 'APPROVED',
        reason: 'Sai mô tả',
      }).ok,
    ).toBe(true);
  });
});

describe('publicProductAvailability', () => {
  it.each([
    ['APPROVED', 'PUBLISHED', 'VISIBLE'],
    ['APPROVED', 'DRAFT', 'MISSING'],
    ['APPROVED', 'WITHDRAWN', 'UNAVAILABLE'],
    ['SUSPENDED', 'PUBLISHED', 'UNAVAILABLE'],
    ['SUSPENDED', 'WITHDRAWN', 'UNAVAILABLE'],
    ['SUSPENDED', 'DRAFT', 'MISSING'],
    ['PENDING_REVIEW', 'PUBLISHED', 'MISSING'],
    ['REJECTED', 'WITHDRAWN', 'MISSING'],
  ] as const)('hộ %s + sản phẩm %s ⇒ %s', (household, product, expected) => {
    expect(publicProductAvailability(household, product)).toBe(expected);
  });

  it('chỉ VISIBLE khi hộ APPROVED và sản phẩm PUBLISHED', () => {
    for (const h of HOUSEHOLD_STATUSES) {
      for (const p of PRODUCT_STATUSES) {
        const visible = publicProductAvailability(h, p) === 'VISIBLE';
        expect(visible).toBe(h === 'APPROVED' && p === 'PUBLISHED');
      }
    }
  });
});
