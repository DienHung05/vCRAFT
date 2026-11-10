/** Browser-kept RFQ drafts live under `vcraft.rfq-draft:<userId>`; the bare key is the old shared one. */
export const RFQ_DRAFT_KEY_PREFIX = 'vcraft.rfq-draft';

export function rfqDraftKey(userId: string): string {
  return `${RFQ_DRAFT_KEY_PREFIX}:${userId}`;
}

/** Removes every browser-kept RFQ draft (all users plus the legacy shared key). Used on sign-out and deletion. */
export function clearAllStoredRfqDrafts(): void {
  try {
    const keys: string[] = [];
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i);
      if (key?.startsWith(RFQ_DRAFT_KEY_PREFIX)) keys.push(key);
    }
    for (const key of keys) window.localStorage.removeItem(key);
  } catch {
    // Storage can be unavailable; nothing to clear.
  }
}
