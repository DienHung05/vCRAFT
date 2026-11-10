import { z } from 'zod';
import { AccountRoleSchema, AccountStatusSchema } from '../auth';
import {
  CursorPageQuerySchema,
  cursorPageSchema,
  IdSchema,
  IsoDateTimeSchema,
  MAX_PAGE_LIMIT,
} from '../common';
import { OnBehalfOfSchema, RfqStatusSchema } from '../rfq/create-rfq';

/** Every action written to the audit log. The screen offers these as the action filter. */
export const AUDIT_ACTIONS = [
  'household.approve',
  'household.reject',
  'household.request_info',
  'household.suspend',
  'household.reinstate',
  'household.reveal_id_number',
  'household.set_id_number',
  'household.certification_verify',
  'household.certification_unverify',
  'household.resubmit',
  'household.submit',
  'product.publish',
  'product.withdraw',
  'product.republish',
  'product.mark_sold',
  'product.back_on_sale',
  'rfq.create',
  'rfq.claim',
  'rfq.invite',
  'rfq.quotation_submit',
  'rfq.start_production',
  'rfq.confirm_receipt',
  'rfq.cancel',
  'allocation.reallocate',
  // Payments (ADR-0021, GH#205).
  'payment.record_offline',
  'payment.refund',
  'payment.simulate_transfer',
  // Unapplied incoming money handled by hand (GH#417).
  'payment.unapplied_resolve',
  'news.create',
  'news.update',
  'news.publish',
  'news.unpublish',
  'news.delete',
  'account.delete',
  // A person withdrew a consent (Decree 13/2023/ND-CP Art. 12, GH#418).
  'consent.withdraw',
  // Account administration (FR-AUTH-03, FR-AUTH-10, GH#239).
  'user.suspend',
  'user.unsuspend',
  'user.invite',
  // A household tried to change another household's record (AC-4, GH#237).
  'access.denied',
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

const DateOnlySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

/** `GET /admin/audit-log`: newest first. `from` and `to` are calendar days in Vietnam time. */
export const AuditLogQuerySchema = CursorPageQuerySchema.extend({
  actorId: IdSchema.optional(),
  action: z.enum(AUDIT_ACTIONS).optional(),
  from: DateOnlySchema.optional(),
  to: DateOnlySchema.optional(),
});
export type AuditLogQuery = z.infer<typeof AuditLogQuerySchema>;

export const AuditEntrySchema = z.object({
  id: IdSchema,
  actorId: IdSchema,
  /** Full name, or email when the account has no name. Null if the account no longer exists. */
  actorName: z.string().nullable(),
  action: z.string(),
  entity: z.string(),
  entityId: IdSchema,
  /**
   * Readable, safe target label: the name/title stored in the event's snapshot, or one bulk lookup per
   * page for a household/news row that still exists. `null` for a legacy entry without a label in its
   * snapshot and for a deleted row whose snapshot has no name; `entityId` always stays for tracing.
   */
  targetLabel: z.string().nullable().optional(),
  before: z.record(z.string(), z.unknown()).nullable(),
  after: z.record(z.string(), z.unknown()).nullable(),
  createdAt: IsoDateTimeSchema,
});
export type AuditEntryDto = z.infer<typeof AuditEntrySchema>;
export const AuditLogPageSchema = cursorPageSchema(AuditEntrySchema);
export type AuditLogPageDto = z.infer<typeof AuditLogPageSchema>;

/** Administrator accounts, for the actor filter. */
export const AuditActorSchema = z.object({ id: IdSchema, name: z.string() });
export type AuditActorDto = z.infer<typeof AuditActorSchema>;
export const AuditActorListSchema = z.array(AuditActorSchema);

/** One row of `GET /admin/coordination`: a request whose buyer asked the board to coordinate. */
export const CoordinationQueueItemSchema = z.object({
  id: IdSchema,
  version: z.int().min(0),
  status: RfqStatusSchema,
  design: z.string(),
  quantity: z.int().min(1),
  unit: z.string(),
  requiredBy: IsoDateTimeSchema,
  biddingClosesAt: IsoDateTimeSchema,
  buyerName: z.string(),
  /** Active household offers so far. Counts only: household prices never appear in the queue. */
  contributionCount: z.int().min(0),
  /** Null while nobody has claimed the request. */
  coordinatorName: z.string().nullable(),
  claimed: z.boolean(),
  claimedByMe: z.boolean(),
  /** Set when the request was made by an administrator for an off-platform customer (FR-ORD-10). */
  onBehalfOf: OnBehalfOfSchema.nullable().optional(),
});
export type CoordinationQueueItemDto = z.infer<typeof CoordinationQueueItemSchema>;
export const CoordinationQueueSchema = z.array(CoordinationQueueItemSchema);

/** `GET /admin/users`: accounts for the suspension screen, newest first. `q` matches email, name or username. */
export const AdminUserListQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
  role: AccountRoleSchema.optional(),
  status: AccountStatusSchema.optional(),
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_LIMIT).default(50),
});
export type AdminUserListQuery = z.infer<typeof AdminUserListQuerySchema>;

export const AdminUserSchema = z.object({
  id: IdSchema,
  email: z.string(),
  username: z.string().nullable(),
  fullName: z.string().nullable(),
  role: AccountRoleSchema,
  status: AccountStatusSchema,
  /** Why the account is suspended; null while it is active. */
  statusReason: z.string().nullable(),
  createdAt: IsoDateTimeSchema,
});
export type AdminUserDto = z.infer<typeof AdminUserSchema>;
export const AdminUserListSchema = z.object({ items: z.array(AdminUserSchema) });
export type AdminUserListDto = z.infer<typeof AdminUserListSchema>;

/** `POST /admin/users/:id/suspend`: the reason is required and goes to the audit log (FR-AUTH-10). */
export const SuspendUserRequestSchema = z.object({
  reason: z.string().trim().min(3).max(500),
});
export type SuspendUserRequest = z.infer<typeof SuspendUserRequestSchema>;

/** `POST /admin/users/:id/unsuspend`: the reason is optional. */
export const UnsuspendUserRequestSchema = z.object({
  reason: z.string().trim().max(500).optional(),
});
export type UnsuspendUserRequest = z.infer<typeof UnsuspendUserRequestSchema>;

/** Roles an administrator can give by invitation (FR-AUTH-03). Buyers sign themselves up. */
export const INVITABLE_ROLES = ['HOUSEHOLD', 'ADMIN'] as const;
export const InvitableRoleSchema = z.enum(INVITABLE_ROLES);
export type InvitableRole = z.infer<typeof InvitableRoleSchema>;

/** `POST /admin/invitations`. */
export const InviteAccountRequestSchema = z.object({
  email: z
    .email()
    .max(320)
    .transform((value) => value.toLowerCase()),
  role: InvitableRoleSchema,
});
export type InviteAccountRequest = z.infer<typeof InviteAccountRequestSchema>;

export const InvitationStatusSchema = z.enum(['PENDING', 'ACCEPTED']);

export const InvitationSchema = z.object({
  id: IdSchema,
  email: z.string(),
  role: AccountRoleSchema,
  status: InvitationStatusSchema,
  /** Full name, or email, of the administrator who invited; null if that account is gone. */
  invitedByName: z.string().nullable(),
  createdAt: IsoDateTimeSchema,
  acceptedAt: IsoDateTimeSchema.nullable(),
});
export type InvitationDto = z.infer<typeof InvitationSchema>;
export const InvitationListSchema = z.object({ items: z.array(InvitationSchema) });
export type InvitationListDto = z.infer<typeof InvitationListSchema>;
