/**
 * Account username (GH#212): the human-readable handle a person signs in with instead of an email.
 * Stored lowercase in `app_user.username` (unique, nullable); case-insensitive by construction —
 * every value is trimmed and lowercased before validation, so `An.Nguyen` and `an.nguyen` are the
 * same account. Reserved words are reserved for seeded demo and system accounts only.
 *
 * This module stays framework-free (the domain imports no schema library): the zod `UsernameSchema`
 * lives in `@vcraft/contracts` and is built from the three primitives exported here
 * (`normalizeUsername`, `isValidUsername`, `isReservedUsername`), so web and API validate through
 * one rule source.
 */

/** Minimum length of a username (GH#212). */
export const USERNAME_MIN_LENGTH = 3;
/** Maximum length of a username; also the width of the `app_user.username` column. */
export const USERNAME_MAX_LENGTH = 30;

/** Allowed characters after lowercasing: letters, digits, dot, underscore, hyphen. */
export const USERNAME_PATTERN = /^[a-z0-9._-]+$/;

/**
 * Usernames reserved for seeded demo and system accounts (GH#212). Nobody else may claim them:
 * `admin`, `root` and `support` would impersonate the platform; `buyer`, `household` and `pending`
 * are the handles of the fixed demo accounts. Keep in sync with the demo seed
 * (`packages/database/src/seeders/demo/accounts.ts`).
 */
export const RESERVED_USERNAMES = [
  'admin',
  'root',
  'support',
  'buyer',
  'household',
  'pending',
] as const;

/** Trims and lowercases free-form input the way every username is stored. */
export function normalizeUsername(value: string): string {
  return value.trim().toLowerCase();
}

/** True when the value (already normalized or not) is a well-formed username. */
export function isValidUsername(value: string): boolean {
  const normalized = normalizeUsername(value);
  return (
    normalized.length >= USERNAME_MIN_LENGTH &&
    normalized.length <= USERNAME_MAX_LENGTH &&
    USERNAME_PATTERN.test(normalized)
  );
}

/** True when the (already normalized) username is reserved for a system or demo account. */
export function isReservedUsername(value: string): boolean {
  return (RESERVED_USERNAMES as readonly string[]).includes(normalizeUsername(value));
}
