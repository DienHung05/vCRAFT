/**
 * Consent to the privacy policy (NFR-SEC-07, Vietnam Decree 13/2023/ND-CP). Consent is recorded per
 * purpose, per policy version, so a change of policy asks again and the record shows what was agreed.
 */

/**
 * Version of the privacy policy text people consent to (an ISO date). Bump it together with the
 * "last updated" line of the policy page whenever the policy changes in a way that needs new consent.
 */
export const PRIVACY_POLICY_VERSION = '2026-11-01';

/**
 * - `SIGN_UP`: creating an account and, for a household, applying to be listed.
 * - `ID_DOCUMENT`: uploading identity papers to the private store.
 * - `RFQ_CONTACT`: giving a delivery address and contact details in a quotation request.
 * - `MAKER_PROFILE`: publishing a person's name and role as a maker.
 */
export const CONSENT_PURPOSES = ['SIGN_UP', 'ID_DOCUMENT', 'RFQ_CONTACT', 'MAKER_PROFILE'] as const;
export type ConsentPurpose = (typeof CONSENT_PURPOSES)[number];

/** True when the version string is the one this build accepts consent for. */
export function isCurrentPolicyVersion(version: string): boolean {
  return version === PRIVACY_POLICY_VERSION;
}
