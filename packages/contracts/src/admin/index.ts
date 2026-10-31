import { z } from 'zod';
import { CursorPageQuerySchema, cursorPageSchema, IdSchema, IsoDateTimeSchema } from '../common';
import { RfqStatusSchema } from '../rfq/create-rfq';

/** Every action written to the audit log. The screen offers these as the action filter. */
export const AUDIT_ACTIONS = [
  'household.approve',
  'household.reject',
  'household.request_info',
  'household.suspend',
  'household.reinstate',
  'product.publish',
  'product.withdraw',
  'product.republish',
  'rfq.claim',
  'rfq.invite',
  'rfq.quotation_submit',
  'rfq.start_production',
  'rfq.confirm_receipt',
  'rfq.cancel',
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
});
export type CoordinationQueueItemDto = z.infer<typeof CoordinationQueueItemSchema>;
export const CoordinationQueueSchema = z.array(CoordinationQueueItemSchema);
