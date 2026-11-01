import 'reflect-metadata';
import { MikroORM, type Options } from '@mikro-orm/core';
import { createMikroOrmOptions } from '../mikro-orm.config.js';
import { createFieldCipher } from './field-cipher.js';
import { rotateFieldEncryption } from './rotate.js';

/**
 * `pnpm db:rotate-field-keys`: re-seal encrypted columns with the first key of `FIELD_ENCRYPTION_KEYS`.
 * Put the new key first, keep the old ones after it, run this, then drop the old keys.
 */
async function main(): Promise<void> {
  const cipher = createFieldCipher(process.env);
  const orm = await MikroORM.init(createMikroOrmOptions(process.env) as unknown as Options);
  try {
    const summary = await orm.em.fork().transactional((em) => rotateFieldEncryption(em, cipher));
    console.log(`db:rotate-field-keys: key ${cipher.currentKeyId}`, JSON.stringify(summary));
  } finally {
    await orm.close(true);
  }
}

main().catch((error: unknown) => {
  // The error is a FieldEncryptionError or a database error; neither carries key or value material.
  console.error('db:rotate-field-keys failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
