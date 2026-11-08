import { describe, expect, it } from 'vitest';
import { householdReviewState } from '../src/household/household-state-machine.js';

/**
 * vCRAFT-8my.2 — derived review state: an active information request always outranks the
 * resubmission marker, and only a pending application can be in a review state at all.
 */
describe('householdReviewState', () => {
  it('NEW for every non-pending status, whatever the reason or marker', () => {
    expect(householdReviewState('APPROVED', null, new Date())).toBe('NEW');
    expect(householdReviewState('APPROVED', 'old reason', new Date())).toBe('NEW');
    expect(householdReviewState('REJECTED', 'reason', null)).toBe('NEW');
    expect(householdReviewState('SUSPENDED', 'suspended reason', new Date())).toBe('NEW');
  });

  it('NEW for a pending application with no active reason and no marker', () => {
    expect(householdReviewState('PENDING_REVIEW', null, null)).toBe('NEW');
    expect(householdReviewState('PENDING_REVIEW', undefined, undefined)).toBe('NEW');
    expect(householdReviewState('PENDING_REVIEW', '   ', null)).toBe('NEW');
  });

  it('AWAITING_APPLICANT while the request is active, even with an old marker', () => {
    expect(householdReviewState('PENDING_REVIEW', 'Thiếu giấy cư trú', null)).toBe(
      'AWAITING_APPLICANT',
    );
    expect(householdReviewState('PENDING_REVIEW', 'Thiếu giấy cư trú', new Date())).toBe(
      'AWAITING_APPLICANT',
    );
  });

  it('RESUBMITTED once the applicant explicitly resubmitted a cleared request', () => {
    expect(householdReviewState('PENDING_REVIEW', null, new Date())).toBe('RESUBMITTED');
  });
});
