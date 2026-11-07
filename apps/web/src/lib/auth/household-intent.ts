import type { MeDto } from '@vcraft/contracts';

/**
 * GH#180: the Supabase user-metadata flag set when someone starts household registration
 * (`/dang-ky-nghe-nhan`). The account stays a Buyer until the household-info step is submitted, so
 * without this flag nothing could tell a would-be household from a plain Buyer and send it back to
 * the wizard after the next sign-in. Metadata is user-editable: it only steers navigation, never access.
 */
export const HOUSEHOLD_INTENT_KEY = 'household_intent';

/** Window event fired after the account's role or household changes, so `useAccount` reloads `/me`. */
export const ACCOUNT_CHANGED_EVENT = 'vcraft:account-changed';

export function hasHouseholdIntent(metadata: unknown): boolean {
  return (
    typeof metadata === 'object' &&
    metadata !== null &&
    (metadata as Record<string, unknown>)[HOUSEHOLD_INTENT_KEY] === true
  );
}

/** A Buyer who started household registration but has not submitted the household info yet. */
export function hasUnfinishedHouseholdRegistration(
  viewer: Pick<MeDto, 'role' | 'household'> | null,
  intent: boolean,
): boolean {
  return intent && viewer?.role === 'BUYER' && !viewer.household;
}
