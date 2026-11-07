import { Entity, Index, Property, Unique } from '@mikro-orm/decorators/legacy';
import { BaseEntity } from './base.entity.js';

/**
 * One sign-in, for the account security page (GH#83, FR-AUTH): recorded the first time the API sees a
 * Supabase session (`session_id` claim), with how the person signed in (`password`, `oauth`, `otp`...)
 * and whether the session reached `aal2`. `browser` is a coarse label ("Chrome · Windows") and
 * `country` the ISO 3166-1 alpha-2 code the hosting edge reports (FR-AUTH-05: "rough location"). No IP
 * address and no device fingerprint. `userId` has no foreign key, like `ConsentRecord`; rows go with the
 * person's data on account deletion.
 */
@Entity({ tableName: 'login_event' })
@Index({ properties: ['userId', 'createdAt'] })
export class LoginEvent extends BaseEntity {
  @Property({ type: 'uuid' })
  userId!: string;

  @Unique()
  @Property({ type: 'string', length: 64 })
  sessionId!: string;

  @Property({ type: 'string', length: 20 })
  method!: string;

  @Property({ type: 'string', length: 4 })
  aal!: string;

  @Property({ type: 'string', length: 80, nullable: true })
  browser?: string | null;

  @Property({ type: 'string', length: 2, nullable: true })
  country?: string | null;

  /** Set when the person signed this session out with "sign out other devices" (FR-AUTH-05). */
  @Property({ type: 'datetime', length: 3, nullable: true })
  revokedAt?: Date | null;
}
