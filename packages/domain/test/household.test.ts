import { describe, expect, it } from 'vitest';
import {
  HOUSEHOLD_EVENTS,
  HOUSEHOLD_STATUSES,
  type HouseholdEvent,
  type HouseholdStatus,
  householdStructuralNext,
  householdTransition,
  isHouseholdPublic,
  MAX_PRODUCT_TAGS,
  MIN_PRICE_SUGGESTION_SAMPLES,
  normalizeTags,
  PRODUCT_STATUSES,
  type ProductContext,
  productTransition,
  publicProductAvailability,
  suggestProductPrice,
} from '../src';

const EXPECTED: Record<HouseholdStatus, Partial<Record<HouseholdEvent, HouseholdStatus>>> = {
  DRAFT: { SUBMIT: 'PENDING_REVIEW' },
  PENDING_REVIEW: { APPROVE: 'APPROVED', REJECT: 'REJECTED', REQUEST_INFO: 'PENDING_REVIEW' },
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

  it('only the household representative can submit a draft application', () => {
    const asAdmin = householdTransition('DRAFT', 'SUBMIT', { actorRole: 'ADMIN' });
    expect(asAdmin.ok).toBe(false);
    if (!asAdmin.ok) expect(asAdmin.error.code).toBe('FORBIDDEN_ACTOR');
    expect(householdTransition('DRAFT', 'SUBMIT', { actorRole: 'HOUSEHOLD' })).toEqual({
      ok: true,
      value: 'PENDING_REVIEW',
    });
  });

  it('a draft cannot be approved or rejected before it is submitted', () => {
    expect(householdTransition('DRAFT', 'APPROVE', { actorRole: 'ADMIN' }).ok).toBe(false);
    expect(householdTransition('DRAFT', 'REJECT', { actorRole: 'ADMIN', reason: 'x' }).ok).toBe(
      false,
    );
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
    for (const householdStatus of ['DRAFT', 'PENDING_REVIEW', 'SUSPENDED', 'REJECTED'] as const) {
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

describe('Product sold state', () => {
  const owner: ProductContext = {
    actorRole: 'HOUSEHOLD',
    isOwner: true,
    householdStatus: 'APPROVED',
    kind: 'OBJECT',
  };

  it('a one-of-a-kind product goes PUBLISHED to SOLD', () => {
    expect(productTransition('PUBLISHED', 'MARK_SOLD', owner)).toEqual({ ok: true, value: 'SOLD' });
  });

  it('a batch can never be marked sold', () => {
    const r = productTransition('PUBLISHED', 'MARK_SOLD', { ...owner, kind: 'BATCH' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('NOT_ONE_OF_A_KIND');
    const unknown = productTransition('PUBLISHED', 'MARK_SOLD', { ...owner, kind: undefined });
    expect(unknown.ok).toBe(false);
  });

  it('only the owning representative marks a product sold', () => {
    expect(productTransition('PUBLISHED', 'MARK_SOLD', { ...owner, isOwner: false }).ok).toBe(
      false,
    );
    expect(productTransition('PUBLISHED', 'MARK_SOLD', { ...owner, actorRole: 'ADMIN' }).ok).toBe(
      false,
    );
  });

  it('only a published product can be marked sold', () => {
    for (const from of ['DRAFT', 'WITHDRAWN', 'SOLD'] as const) {
      const r = productTransition(from, 'MARK_SOLD', owner);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error.code).toBe('INVALID_TRANSITION');
    }
  });

  it('SOLD goes back on sale (undo) for an approved household only', () => {
    expect(productTransition('SOLD', 'BACK_ON_SALE', owner)).toEqual({
      ok: true,
      value: 'PUBLISHED',
    });
    const suspended = productTransition('SOLD', 'BACK_ON_SALE', {
      ...owner,
      householdStatus: 'SUSPENDED',
    });
    expect(suspended.ok).toBe(false);
    expect(productTransition('SOLD', 'BACK_ON_SALE', { ...owner, isOwner: false }).ok).toBe(false);
  });

  it('a sold product can still be withdrawn (archived) with a reason', () => {
    expect(productTransition('SOLD', 'WITHDRAW', owner).ok).toBe(false);
    expect(productTransition('SOLD', 'WITHDRAW', { ...owner, reason: 'Gone' })).toEqual({
      ok: true,
      value: 'WITHDRAWN',
    });
  });
});

describe('Product republish after a withdrawal', () => {
  const owner: ProductContext = {
    actorRole: 'HOUSEHOLD',
    isOwner: true,
    householdStatus: 'APPROVED',
  };
  const board: ProductContext = { ...owner, actorRole: 'ADMIN', isOwner: false };

  it('the owner republishes a product the owner withdrew, or a legacy row with no record', () => {
    for (const withdrawnBy of ['OWNER', null, undefined] as const) {
      expect(productTransition('WITHDRAWN', 'REPUBLISH', { ...owner, withdrawnBy })).toEqual({
        ok: true,
        value: 'PUBLISHED',
      });
    }
  });

  it('the owner cannot republish a product the board withdrew', () => {
    const r = productTransition('WITHDRAWN', 'REPUBLISH', { ...owner, withdrawnBy: 'BOARD' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('BOARD_WITHDRAWN');
  });

  it('the board republishes only what the board withdrew', () => {
    expect(productTransition('WITHDRAWN', 'REPUBLISH', { ...board, withdrawnBy: 'BOARD' })).toEqual(
      { ok: true, value: 'PUBLISHED' },
    );
    const r = productTransition('WITHDRAWN', 'REPUBLISH', { ...board, withdrawnBy: 'OWNER' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('NOT_BOARD_WITHDRAWN');
  });

  it('a board republish still needs an approved household', () => {
    const r = productTransition('WITHDRAWN', 'REPUBLISH', {
      ...board,
      withdrawnBy: 'BOARD',
      householdStatus: 'SUSPENDED',
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('HOUSEHOLD_NOT_APPROVED');
  });
});

describe('normalizeTags', () => {
  it('trims, collapses spaces, keeps diacritics and drops case-insensitive duplicates', () => {
    expect(normalizeTags(['  Gốm   Bát Tràng ', 'gốm bát tràng', 'GỐM', 'gom', ''])).toEqual([
      'Gốm Bát Tràng',
      'GỐM',
      'gom',
    ]);
  });

  it('drops tags longer than 30 characters and keeps at most 10', () => {
    expect(normalizeTags(['x'.repeat(31), 'ok'])).toEqual(['ok']);
    const many = Array.from({ length: 15 }, (_, i) => `tag${i}`);
    expect(normalizeTags(many)).toHaveLength(MAX_PRODUCT_TAGS);
  });
});

describe('suggestProductPrice', () => {
  it('is null below the minimum number of comparable prices', () => {
    expect(MIN_PRICE_SUGGESTION_SAMPLES).toBe(3);
    expect(suggestProductPrice([100_000, 200_000])).toBeNull();
    expect(suggestProductPrice([0, 0, 100_000, 200_000])).toBeNull();
  });

  it('is the median of the listed prices with the count it is based on', () => {
    expect(suggestProductPrice([300_000, 100_000, 200_000])).toEqual({
      medianVnd: 200_000,
      count: 3,
    });
    expect(suggestProductPrice([100_000, 400_000, 200_000, 300_001])).toEqual({
      medianVnd: 250_001,
      count: 4,
    });
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
    ['APPROVED', 'SOLD', 'VISIBLE'],
    ['SUSPENDED', 'SOLD', 'UNAVAILABLE'],
    ['PENDING_REVIEW', 'SOLD', 'MISSING'],
    ['PENDING_REVIEW', 'PUBLISHED', 'MISSING'],
    ['REJECTED', 'WITHDRAWN', 'MISSING'],
  ] as const)('hộ %s + sản phẩm %s ⇒ %s', (household, product, expected) => {
    expect(publicProductAvailability(household, product)).toBe(expected);
  });

  it('chỉ VISIBLE khi hộ APPROVED và sản phẩm PUBLISHED hoặc SOLD', () => {
    for (const h of HOUSEHOLD_STATUSES) {
      for (const p of PRODUCT_STATUSES) {
        const visible = publicProductAvailability(h, p) === 'VISIBLE';
        expect(visible).toBe(h === 'APPROVED' && (p === 'PUBLISHED' || p === 'SOLD'));
      }
    }
  });
});
