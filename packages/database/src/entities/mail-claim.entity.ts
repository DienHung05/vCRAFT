import { Entity, Property, Unique } from '@mikro-orm/decorators/legacy';
import { BaseEntity } from './base.entity.js';

/**
 * Durable "this mail is being sent" marker keyed by the BullMQ job id, which the outbox derives from the
 * outbox event id (GH#429). BullMQ job ids are not enough on their own: `trimFinishedJobs` removes them at
 * boot, so a reclaimed outbox event would resend the mail. The worker claims the key by inserting the row
 * (the unique index lets exactly one caller win), stamps `sentAt` after the send and deletes the row if
 * the send fails. A claim with no `sentAt` older than the worker's lease is taken over, which recovers a
 * claim whose worker died mid-send. `claimKey` has no foreign key.
 */
@Entity({ tableName: 'mail_claim' })
@Unique({ properties: ['claimKey'] })
export class MailClaim extends BaseEntity {
  @Property({ type: 'string', length: 100 })
  claimKey!: string;

  @Property({ type: 'datetime', length: 3 })
  claimedAt: Date = new Date();

  @Property({ type: 'datetime', length: 3, nullable: true })
  sentAt?: Date | null;
}
