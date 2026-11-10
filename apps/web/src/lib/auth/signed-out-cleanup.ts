import { clearRememberPreference } from './remember';

/** Every browser-kept RFQ draft key starts with this; the user id follows (GH#420). */
export const RFQ_DRAFT_KEY_PREFIX = 'vcraft.rfq-draft';

/** The browser key of one person's unfinished RFQ form, so people sharing a browser never see each other's. */
export function rfqDraftKey(userId: string): string {
  return `${RFQ_DRAFT_KEY_PREFIX}:${userId}`;
}

/** Removes every browser-kept RFQ draft, including the old shared key from before GH#420. */
export function clearRfqDrafts(): void {
  try {
    const storage = window.localStorage;
    const keys: string[] = [];
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (key?.startsWith(RFQ_DRAFT_KEY_PREFIX)) keys.push(key);
    }
    for (const key of keys) storage.removeItem(key);
  } catch {
    // Storage can be unavailable; then nothing was kept either.
  }
}

/**
 * Forgets what this browser kept for the signed-in person: the remember-me marker and RFQ drafts (with
 * their delivery address and customer contact). Called on every sign-out and after account deletion.
 */
export function clearSignedInBrowserData(): void {
  clearRememberPreference();
  clearRfqDrafts();
}
