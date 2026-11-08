import { describe, expect, it } from 'vitest';
import { PasswordSignInRequestSchema, PasswordSignUpRequestSchema } from '../src/auth';

const registration = {
  username: 'pottery.buyer',
  email: 'buyer@example.com',
  privacyPolicyVersion: '2026-11-01',
};

describe('password authentication policy', () => {
  it.each(['Abcdefgh1', 'abcdefghij1', 'ABCDEFGHIJ1', 'Abcdefghijk', 'ééééééééÉ1'])(
    'rejects a new password that does not meet the provider policy: %s',
    (password) => {
      const result = PasswordSignUpRequestSchema.safeParse({ ...registration, password });
      expect(result.success).toBe(false);
      expect(result.error?.issues.some((issue) => issue.path[0] === 'password')).toBe(true);
    },
  );

  it('accepts a password at the minimum length with all required character classes', () => {
    expect(
      PasswordSignUpRequestSchema.safeParse({ ...registration, password: 'Abcdefghi1' }).success,
    ).toBe(true);
  });

  it('allows existing credentials that do not meet the new password policy', () => {
    expect(
      PasswordSignInRequestSchema.safeParse({ identifier: 'pottery.buyer', password: '123' })
        .success,
    ).toBe(true);
  });
});
