import { CONSENT_PURPOSES } from '@vcraft/domain';
import { z } from 'zod';
import { IdSchema, IsoDateTimeSchema } from '../common';

/**
 * Personal data rights (NFR-SEC-07, Vietnam Decree 13/2023/ND-CP): recorded consent, a download of
 * everything the platform holds about the signed-in person, and self-service deletion.
 */

export const ConsentPurposeSchema = z.enum(CONSENT_PURPOSES);
export type ConsentPurposeDto = z.infer<typeof ConsentPurposeSchema>;

/** `POST /me/consents`: the person ticked the consent box for `purpose` under this policy version. */
export const RecordConsentRequestSchema = z.strictObject({
  purpose: ConsentPurposeSchema,
  policyVersion: z.string().trim().min(1).max(20),
});
export type RecordConsentRequest = z.infer<typeof RecordConsentRequestSchema>;

export const ConsentResponseSchema = z.strictObject({
  id: IdSchema,
  purpose: ConsentPurposeSchema,
  policyVersion: z.string(),
  givenAt: IsoDateTimeSchema,
});
export type ConsentDto = z.infer<typeof ConsentResponseSchema>;

/** `GET /me/consents`: every consent on record, plus the policy version the app currently asks for. */
export const ConsentListResponseSchema = z.strictObject({
  currentPolicyVersion: z.string(),
  data: z.array(ConsentResponseSchema),
});
export type ConsentListResponse = z.infer<typeof ConsentListResponseSchema>;

/**
 * `DELETE /me`: `confirmation` must be the account's own email (compared case-insensitively), so a
 * stray request cannot delete an account. The web asks the person to type it in a confirm dialog.
 */
export const DeleteAccountRequestSchema = z.strictObject({
  confirmation: z.string().trim().min(1).max(320),
});
export type DeleteAccountRequest = z.infer<typeof DeleteAccountRequestSchema>;

const ExportRowSchema = z.record(z.string(), z.unknown());

/** A file the person uploaded. `url` is a time-limited signed link for private files. */
export const ExportedMediaSchema = z.strictObject({
  id: IdSchema,
  purpose: z.string(),
  visibility: z.enum(['PUBLIC', 'PRIVATE']),
  status: z.string(),
  mimeType: z.string(),
  sizeBytes: z.int().nonnegative(),
  sha256: z.string(),
  createdAt: IsoDateTimeSchema,
  url: z.string().nullable(),
  urlExpiresAt: IsoDateTimeSchema.nullable(),
});
export type ExportedMediaDto = z.infer<typeof ExportedMediaSchema>;

/**
 * `GET /me/data-export`: the person's own personal data as one JSON document. Rows are the stored
 * values (dates as ISO strings). Only data the person owns or entered is included: other parties'
 * names, quotations or prices never appear.
 */
export const DataExportSchema = z.strictObject({
  schemaVersion: z.literal(1),
  exportedAt: IsoDateTimeSchema,
  policyVersion: z.string(),
  account: z.strictObject({
    id: IdSchema,
    email: z.string(),
    fullName: z.string().nullable(),
    role: z.string(),
    status: z.string(),
    createdAt: IsoDateTimeSchema,
  }),
  /** Present when the account represents a household. */
  household: z
    .strictObject({
      profile: ExportRowSchema,
      workshops: z.array(ExportRowSchema),
      artisans: z.array(ExportRowSchema),
      /** Each product carries its production journal entries. */
      products: z.array(ExportRowSchema),
    })
    .nullable(),
  /** Quotation requests the person made as a buyer. */
  quotationRequests: z.array(ExportRowSchema),
  /** The household's own offers to quotation requests. */
  contributions: z.array(ExportRowSchema),
  /** The household's own order allocations. */
  allocations: z.array(ExportRowSchema),
  notifications: z.array(ExportRowSchema),
  emailPreferences: z.array(ExportRowSchema),
  consents: z.array(ConsentResponseSchema),
  media: z.array(ExportedMediaSchema),
});
export type DataExportDto = z.infer<typeof DataExportSchema>;
