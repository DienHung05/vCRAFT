import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

/**
 * Field-level encryption of sensitive values (NFR-SEC-03): AES-256-GCM, a fresh random 96-bit IV for every
 * value, the authentication tag kept with the ciphertext.
 *
 * Stored format: `<keyId>:<iv>:<tag>:<ciphertext>`, the last three base64url. `keyId` is the label of the key
 * in `FIELD_ENCRYPTION_KEYS` that sealed the value, so old values stay readable after the keys are rotated.
 * The `context` string (for example `household.id_number`) is bound in as additional authenticated data: a value
 * copied into another field fails authentication instead of decrypting there.
 */

/** `FIELD_ENCRYPTION_KEYS`: `<keyId>:<base64 of 32 bytes>[,<keyId>:<base64>...]`. The first key encrypts; every key decrypts. */
export const FIELD_KEYS_ENV = 'FIELD_ENCRYPTION_KEYS';

const KEY_BYTES = 32;
const IV_BYTES = 12;
const TAG_BYTES = 16;
const KEY_ID_PATTERN = /^[A-Za-z0-9_-]{1,16}$/;
const BASE64_PATTERN = /^[A-Za-z0-9+/_-]+={0,2}$/;

/** Raised for bad configuration or a value that cannot be opened. Messages never carry key or value material. */
export class FieldEncryptionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FieldEncryptionError';
  }
}

interface FieldKey {
  readonly id: string;
  readonly key: Buffer;
}

function parseKeys(raw: string | undefined): FieldKey[] {
  if (raw === undefined || raw.trim() === '') {
    throw new FieldEncryptionError(
      `${FIELD_KEYS_ENV} is not set; generate a key with "openssl rand -base64 32" and set it as "v1:<key>"`,
    );
  }
  const keys: FieldKey[] = [];
  for (const [index, entry] of raw.split(',').entries()) {
    const position = `${FIELD_KEYS_ENV} entry ${index + 1}`;
    const separator = entry.indexOf(':');
    const id = separator < 0 ? '' : entry.slice(0, separator).trim();
    const encoded = separator < 0 ? '' : entry.slice(separator + 1).trim();
    if (!KEY_ID_PATTERN.test(id) || encoded === '') {
      throw new FieldEncryptionError(`${position} must look like "<keyId>:<base64 key>"`);
    }
    if (!BASE64_PATTERN.test(encoded)) {
      throw new FieldEncryptionError(`${position} (${id}) is not valid base64`);
    }
    const key = Buffer.from(encoded, 'base64');
    if (key.length !== KEY_BYTES) {
      throw new FieldEncryptionError(
        `${position} (${id}) must decode to exactly ${KEY_BYTES} bytes (AES-256), got ${key.length}`,
      );
    }
    if (keys.some((known) => known.id === id)) {
      throw new FieldEncryptionError(`${position}: key id "${id}" is used twice`);
    }
    keys.push({ id, key });
  }
  return keys;
}

export class FieldCipher {
  private readonly keys: readonly FieldKey[];

  /** Throws {@link FieldEncryptionError} on a missing or malformed key list, so a bad deploy fails at startup. */
  constructor(rawKeys: string | undefined) {
    this.keys = parseKeys(rawKeys);
  }

  /** The key id new values are sealed with. */
  get currentKeyId(): string {
    return (this.keys[0] as FieldKey).id;
  }

  encrypt(plaintext: string, context: string): string {
    const current = this.keys[0] as FieldKey;
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv('aes-256-gcm', current.key, iv, { authTagLength: TAG_BYTES });
    cipher.setAAD(Buffer.from(context, 'utf8'));
    const sealed = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    return [
      current.id,
      iv.toString('base64url'),
      cipher.getAuthTag().toString('base64url'),
      sealed.toString('base64url'),
    ].join(':');
  }

  decrypt(value: string, context: string): string {
    const parts = value.split(':');
    const [keyId, iv, tag, sealed] = parts;
    if (parts.length !== 4 || !keyId || !iv || !tag || sealed === undefined) {
      throw new FieldEncryptionError('stored value is not in the encrypted format');
    }
    const key = this.keys.find((known) => known.id === keyId);
    if (!key) throw new FieldEncryptionError(`no key "${keyId}" configured to open this value`);
    try {
      const ivBytes = Buffer.from(iv, 'base64url');
      const tagBytes = Buffer.from(tag, 'base64url');
      if (ivBytes.length !== IV_BYTES || tagBytes.length !== TAG_BYTES) throw new Error('size');
      const decipher = createDecipheriv('aes-256-gcm', key.key, ivBytes, {
        authTagLength: TAG_BYTES,
      });
      decipher.setAAD(Buffer.from(context, 'utf8'));
      decipher.setAuthTag(tagBytes);
      return Buffer.concat([
        decipher.update(Buffer.from(sealed, 'base64url')),
        decipher.final(),
      ]).toString('utf8');
    } catch {
      // Deliberately no cause: the underlying error must not become a log line about this value.
      throw new FieldEncryptionError('stored value failed authentication (wrong key or tampered)');
    }
  }

  /** True when the value was sealed with an older key than the current one. */
  needsRotation(value: string): boolean {
    return value.split(':', 1)[0] !== this.currentKeyId;
  }

  /** Re-seal a value with the current key. Same plaintext, new IV. */
  rotate(value: string, context: string): string {
    return this.encrypt(this.decrypt(value, context), context);
  }
}

/** Build the cipher from the process environment; used at API, worker and seeder startup. */
export function createFieldCipher(
  env: Readonly<Record<string, string | undefined>> = process.env,
): FieldCipher {
  return new FieldCipher(env[FIELD_KEYS_ENV]);
}

/** Context strings for every encrypted field, so a value cannot be moved between fields. */
export const FIELD_CONTEXTS = { householdIdNumber: 'household.id_number' } as const;
