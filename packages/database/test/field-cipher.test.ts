import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { createFieldCipher, FIELD_CONTEXTS, FieldCipher, FieldEncryptionError } from '../src';

const key = () => randomBytes(32).toString('base64');
const CONTEXT = FIELD_CONTEXTS.householdIdNumber;
const ID = '012345678901';

describe('FieldCipher', () => {
  it('round-trips a value and stores no plaintext', () => {
    const cipher = new FieldCipher(`v1:${key()}`);
    const sealed = cipher.encrypt(ID, CONTEXT);
    expect(sealed).not.toContain(ID);
    expect(sealed).toMatch(/^v1:[\w-]{16}:[\w-]{22}:[\w-]+$/);
    expect(cipher.decrypt(sealed, CONTEXT)).toBe(ID);
  });

  it('uses a fresh random IV every time', () => {
    const cipher = new FieldCipher(`v1:${key()}`);
    const values = new Set(Array.from({ length: 50 }, () => cipher.encrypt(ID, CONTEXT)));
    expect(values.size).toBe(50);
    expect(new Set([...values].map((value) => value.split(':')[1])).size).toBe(50);
  });

  it('detects tampering with the IV, the tag or the ciphertext', () => {
    const cipher = new FieldCipher(`v1:${key()}`);
    const [id, iv, tag, sealed] = cipher.encrypt(ID, CONTEXT).split(':') as [
      string,
      string,
      string,
      string,
    ];
    const flip = (value: string) => `${value[0] === 'A' ? 'B' : 'A'}${value.slice(1)}`;
    for (const tampered of [
      `${id}:${flip(iv)}:${tag}:${sealed}`,
      `${id}:${iv}:${flip(tag)}:${sealed}`,
      `${id}:${iv}:${tag}:${flip(sealed)}`,
    ]) {
      expect(() => cipher.decrypt(tampered, CONTEXT)).toThrow(FieldEncryptionError);
    }
  });

  it('refuses to open a value in a different field (context is authenticated)', () => {
    const cipher = new FieldCipher(`v1:${key()}`);
    const sealed = cipher.encrypt(ID, CONTEXT);
    expect(() => cipher.decrypt(sealed, 'household.other_field')).toThrow(FieldEncryptionError);
  });

  it('refuses a wrong key and a key id it does not have', () => {
    const sealed = new FieldCipher(`v1:${key()}`).encrypt(ID, CONTEXT);
    expect(() => new FieldCipher(`v1:${key()}`).decrypt(sealed, CONTEXT)).toThrow(/authentication/);
    expect(() => new FieldCipher(`v9:${key()}`).decrypt(sealed, CONTEXT)).toThrow(/no key "v1"/);
  });

  it('rejects text that is not in the encrypted format', () => {
    const cipher = new FieldCipher(`v1:${key()}`);
    for (const bad of [ID, '', 'v1:a:b', 'v1:a:b:c:d']) {
      expect(() => cipher.decrypt(bad, CONTEXT)).toThrow(FieldEncryptionError);
    }
  });

  it('rotates: the first key encrypts, every key still decrypts, rotate() moves values to the newest', () => {
    const k1 = key();
    const k2 = key();
    const before = new FieldCipher(`v1:${k1}`).encrypt(ID, CONTEXT);
    const rotated = new FieldCipher(`v2:${k2},v1:${k1}`);
    expect(rotated.currentKeyId).toBe('v2');
    expect(rotated.decrypt(before, CONTEXT)).toBe(ID);
    expect(rotated.encrypt(ID, CONTEXT).startsWith('v2:')).toBe(true);
    expect(rotated.needsRotation(before)).toBe(true);
    const after = rotated.rotate(before, CONTEXT);
    expect(after.startsWith('v2:')).toBe(true);
    expect(rotated.needsRotation(after)).toBe(false);
    expect(rotated.decrypt(after, CONTEXT)).toBe(ID);
    // Once v1 is dropped from the list, only values that were not rotated are lost.
    expect(new FieldCipher(`v2:${k2}`).decrypt(after, CONTEXT)).toBe(ID);
    expect(() => new FieldCipher(`v2:${k2}`).decrypt(before, CONTEXT)).toThrow(
      FieldEncryptionError,
    );
  });

  it('accepts base64 and base64url keys', () => {
    const raw = randomBytes(32);
    expect(() => new FieldCipher(`v1:${raw.toString('base64url')}`)).not.toThrow();
    expect(() => new FieldCipher(`v1:${raw.toString('base64')}`)).not.toThrow();
  });
});

describe('FieldCipher configuration (fail fast)', () => {
  it.each([
    ['unset', undefined],
    ['blank', '   '],
    ['no key id', key()],
    ['empty key', 'v1:'],
    ['bad key id', `bad id!:${key()}`],
    ['not base64', 'v1:!!!not-base64!!!'],
    ['too short', `v1:${randomBytes(16).toString('base64')}`],
    ['too long', `v1:${randomBytes(48).toString('base64')}`],
    ['duplicate id', `v1:${key()},v1:${key()}`],
    ['one bad entry among good ones', `v2:${key()},v1:short`],
  ])('throws for %s', (_name, value) => {
    expect(() => new FieldCipher(value)).toThrow(FieldEncryptionError);
  });

  it('never puts key material in an error message', () => {
    const secret = randomBytes(16).toString('base64');
    let message = '';
    try {
      new FieldCipher(`v1:${secret}`);
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).not.toBe('');
    expect(message).not.toContain(secret);
  });

  it('createFieldCipher reads FIELD_ENCRYPTION_KEYS', () => {
    expect(() => createFieldCipher({})).toThrow(FieldEncryptionError);
    expect(createFieldCipher({ FIELD_ENCRYPTION_KEYS: `v1:${key()}` }).currentKeyId).toBe('v1');
  });
});
