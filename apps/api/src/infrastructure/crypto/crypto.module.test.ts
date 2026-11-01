import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import { FieldCipher } from '@vcraft/database';
import { afterEach, describe, expect, it } from 'vitest';
import { CryptoModule } from './crypto.module';

const original = process.env.FIELD_ENCRYPTION_KEYS;
afterEach(() => {
  if (original === undefined) delete process.env.FIELD_ENCRYPTION_KEYS;
  else process.env.FIELD_ENCRYPTION_KEYS = original;
});

describe('CryptoModule', () => {
  it('provides the cipher when FIELD_ENCRYPTION_KEYS is valid', async () => {
    process.env.FIELD_ENCRYPTION_KEYS = `v2:${Buffer.alloc(32, 1).toString('base64')},v1:${Buffer.alloc(32, 2).toString('base64')}`;
    const moduleRef = await Test.createTestingModule({ imports: [CryptoModule] }).compile();
    expect(moduleRef.get(FieldCipher).currentKeyId).toBe('v2');
  });

  it.each([
    ['unset', undefined],
    ['malformed', 'v1:not-a-key'],
    ['wrong length', `v1:${Buffer.alloc(16).toString('base64')}`],
  ])('stops the application from starting when the key list is %s', async (_name, value) => {
    if (value === undefined) delete process.env.FIELD_ENCRYPTION_KEYS;
    else process.env.FIELD_ENCRYPTION_KEYS = value;
    await expect(Test.createTestingModule({ imports: [CryptoModule] }).compile()).rejects.toThrow(
      /FIELD_ENCRYPTION_KEYS/,
    );
  });
});
