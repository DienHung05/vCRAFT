import { Entity, Index, Property } from '@mikro-orm/decorators/legacy';
import type { ConsentPurpose } from '@vcraft/domain';
import { BaseEntity } from './base.entity.js';

/**
 * One consent given by a person (NFR-SEC-07): to what (`purpose`), under which privacy policy text
 * (`policyVersion`), and when (`createdAt`, server time). Append-only: giving consent again for the same
 * purpose and version is a no-op, a new policy version adds a new row. `userId` has no foreign key so the
 * record does not depend on the account row; it is deleted with the person's data on account deletion.
 */
@Entity({ tableName: 'consent_record' })
@Index({ properties: ['userId', 'purpose'] })
export class ConsentRecord extends BaseEntity {
  @Property({ type: 'uuid' })
  userId!: string;

  @Property({ type: 'string', length: 30 })
  purpose!: ConsentPurpose;

  @Property({ type: 'string', length: 20 })
  policyVersion!: string;
}
