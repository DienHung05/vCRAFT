import type { EntityManager } from '@mikro-orm/core';
import { Household } from '../entities/index.js';
import { FIELD_CONTEXTS, type FieldCipher } from './field-cipher.js';

export interface RotationSummary {
  /** Values re-sealed with the current key. */
  rotated: number;
  /** Values that already used the current key. */
  alreadyCurrent: number;
}

/**
 * Re-seal every encrypted column with the current key, after a new key was put first in
 * `FIELD_ENCRYPTION_KEYS`. Run it, then remove the old key from the list once nothing uses it
 * (a second run reports `rotated: 0`). Add every new encrypted column here.
 */
export async function rotateFieldEncryption(
  em: EntityManager,
  cipher: FieldCipher,
): Promise<RotationSummary> {
  const summary: RotationSummary = { rotated: 0, alreadyCurrent: 0 };
  for (const household of await em.find(Household, { idNumberEnc: { $ne: null } })) {
    const value = household.idNumberEnc as string;
    if (!cipher.needsRotation(value)) {
      summary.alreadyCurrent++;
      continue;
    }
    household.idNumberEnc = cipher.rotate(value, FIELD_CONTEXTS.householdIdNumber);
    summary.rotated++;
  }
  await em.flush();
  return summary;
}
