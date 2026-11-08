/** Where a guest's favourites live until sign-in moves them to the account (FR-CAT-07). */
export const FAVOURITES_STORAGE_KEY = 'vcraft.favourites.v1';

/** More than this is never worth keeping; it also bounds the sign-in merge and the guest list query. */
export const MAX_LOCAL_FAVOURITES = 100;

/** Product ids saved in this browser, oldest first. Storage may be blocked or hold junk: that reads as empty. */
export function readLocalFavourites(): string[] {
  try {
    const raw = window.localStorage.getItem(FAVOURITES_STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return [...new Set(parsed.filter((id): id is string => typeof id === 'string'))].slice(
      -MAX_LOCAL_FAVOURITES,
    );
  } catch {
    return [];
  }
}

/** Saves the list, or removes the key when it is empty. Returns false when storage refused the write. */
export function writeLocalFavourites(ids: readonly string[]): boolean {
  try {
    if (ids.length === 0) window.localStorage.removeItem(FAVOURITES_STORAGE_KEY);
    else {
      window.localStorage.setItem(
        FAVOURITES_STORAGE_KEY,
        JSON.stringify(ids.slice(-MAX_LOCAL_FAVOURITES)),
      );
    }
    return true;
  } catch {
    return false;
  }
}
