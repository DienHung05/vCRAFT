import { describe, expect, it } from 'vitest';
import {
  changePasswordSchema,
  registerSchema,
  setPasswordSchema,
  signInSchema,
} from '@/features/auth/schemas';

const schemas = [
  ['registration', registerSchema],
  ['reset', setPasswordSchema],
  ['account change', changePasswordSchema],
] as const;

function values(password: string) {
  return {
    username: 'pottery.buyer',
    email: 'buyer@example.com',
    consent: true,
    current: '123',
    password,
    confirm: password,
  };
}

describe.each(schemas)('%s password validation', (_name, schema) => {
  it.each([
    ['Abcdefgh1', 'passwordShort'],
    ['abcdefghij1', 'passwordWeak'],
    ['ABCDEFGHIJ1', 'passwordWeak'],
    ['Abcdefghijk', 'passwordWeak'],
    ['ééééééééÉ1', 'passwordWeak'],
  ])('rejects %s with a localized validation key', (password, key) => {
    const result = schema.safeParse(values(password));
    expect(result.success).toBe(false);
    expect(result.error?.issues).toContainEqual(
      expect.objectContaining({ path: ['password'], message: key }),
    );
  });

  it('accepts the minimum length and preserves legacy current credentials', () => {
    expect(schema.safeParse(values('Abcdefghi1')).success).toBe(true);
  });
});

it('allows sign-in with legacy credentials', () => {
  expect(signInSchema.safeParse({ identifier: 'pottery.buyer', password: '123' }).success).toBe(
    true,
  );
});
