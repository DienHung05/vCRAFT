import { describe, expect, it } from 'vitest';
import { isEligibleForOpenRequest, isOpenCoordinatedRequest } from '../src';

const base = {
  householdStatus: 'APPROVED',
  representativeLocked: false,
  requestCategory: 'CERAMICS',
  declaredCapacity: 100,
  publishedProducts: 0,
} as const;

describe('isEligibleForOpenRequest (BR-05a)', () => {
  it('accepts an approved household with capacity in the category', () => {
    expect(isEligibleForOpenRequest(base)).toBe(true);
  });

  it('accepts an approved household with a published product but no declared capacity', () => {
    expect(
      isEligibleForOpenRequest({ ...base, declaredCapacity: undefined, publishedProducts: 2 }),
    ).toBe(true);
  });

  it('rejects a household with neither capacity nor product, or that opted out with zero capacity', () => {
    expect(
      isEligibleForOpenRequest({ ...base, declaredCapacity: undefined, publishedProducts: 0 }),
    ).toBe(false);
    expect(isEligibleForOpenRequest({ ...base, declaredCapacity: 0, publishedProducts: 3 })).toBe(
      false,
    );
  });

  it('rejects a household that is not approved or whose representative is locked', () => {
    expect(isEligibleForOpenRequest({ ...base, householdStatus: 'PENDING' })).toBe(false);
    expect(isEligibleForOpenRequest({ ...base, householdStatus: 'SUSPENDED' })).toBe(false);
    expect(isEligibleForOpenRequest({ ...base, representativeLocked: true })).toBe(false);
  });

  it('rejects a request without a category', () => {
    expect(isEligibleForOpenRequest({ ...base, requestCategory: null })).toBe(false);
  });
});

describe('isOpenCoordinatedRequest (BR-05a)', () => {
  const now = new Date('2026-11-10T00:00:00Z');
  const open = {
    status: 'SENT',
    coordinationOptIn: true,
    coordinatorId: 'admin-1',
    biddingClosesAt: new Date('2026-11-12T00:00:00Z'),
  };

  it('is open while coordinated, claimed and before the deadline', () => {
    expect(isOpenCoordinatedRequest(open, now)).toBe(true);
    expect(isOpenCoordinatedRequest({ ...open, status: 'BIDDING' }, now)).toBe(true);
  });

  it('is not open when unclaimed, not coordinated, past the deadline or not accepting offers', () => {
    expect(isOpenCoordinatedRequest({ ...open, coordinatorId: null }, now)).toBe(false);
    expect(isOpenCoordinatedRequest({ ...open, coordinationOptIn: false }, now)).toBe(false);
    expect(
      isOpenCoordinatedRequest({ ...open, biddingClosesAt: new Date('2026-11-09T00:00:00Z') }, now),
    ).toBe(false);
    expect(isOpenCoordinatedRequest({ ...open, status: 'ACCEPTED' }, now)).toBe(false);
  });
});
