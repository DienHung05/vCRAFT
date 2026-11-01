import { describe, expect, it } from 'vitest';
import { CONSENT_PURPOSES, isCurrentPolicyVersion, PRIVACY_POLICY_VERSION } from '../src';

describe('privacy consent', () => {
  it('names one purpose per kind of personal data collected', () => {
    expect([...CONSENT_PURPOSES]).toEqual([
      'SIGN_UP',
      'ID_DOCUMENT',
      'RFQ_CONTACT',
      'MAKER_PROFILE',
    ]);
  });

  it('accepts only the current policy version', () => {
    expect(PRIVACY_POLICY_VERSION).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(isCurrentPolicyVersion(PRIVACY_POLICY_VERSION)).toBe(true);
    expect(isCurrentPolicyVersion('2020-01-01')).toBe(false);
    expect(isCurrentPolicyVersion('')).toBe(false);
  });
});
