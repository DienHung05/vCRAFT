import type { Opt } from '@mikro-orm/core';
import { Entity, Index, Property, Unique } from '@mikro-orm/decorators/legacy';
import type { AccountRole } from '@vcraft/domain';
import { BaseEntity } from './base.entity.js';

export const INVITATION_STATUSES = ['PENDING', 'ACCEPTED'] as const;
export type InvitationStatus = (typeof INVITATION_STATUSES)[number];

/**
 * An administrator's invitation to join vCraft by email (FR-AUTH-03). Supabase sends the mail
 * (`inviteUserByEmail`) and owns the one-time link; this row records which role the invited address
 * gets. The role is applied when the invited person first signs in with that verified email, so the role
 * never travels in user-editable metadata. One row per address: inviting again resends the mail.
 * `invitedBy` has no foreign key, like `AuditLog.actorId`.
 */
@Entity({ tableName: 'account_invitation' })
@Index({ properties: ['status', 'createdAt'] })
export class AccountInvitation extends BaseEntity {
  /** Lowercase. */
  @Unique()
  @Property({ type: 'string', length: 320 })
  email!: string;

  @Property({ type: 'string', length: 20 })
  role!: AccountRole;

  @Property({ type: 'string', length: 10 })
  status: Opt<InvitationStatus> = 'PENDING';

  @Property({ type: 'uuid' })
  invitedBy!: string;

  @Property({ type: 'datetime', length: 3, nullable: true })
  acceptedAt?: Date | null;
}
