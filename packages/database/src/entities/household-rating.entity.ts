import { Entity, Index, ManyToOne, Property, Unique } from '@mikro-orm/decorators/legacy';
import { BaseEntity } from './base.entity.js';
import { Household } from './household.entity.js';
import { QuotationRequest } from './quotation-request.entity.js';

/**
 * A buyer's rating of one household after a request was delivered (FR-ORD-11, BR-05, GH#248 s5-11): 1 to 5
 * stars and an optional comment. One row per (request, household); the owning buyer edits it in place for a
 * limited time (`RATING_EDIT_WINDOW_DAYS` from `createdAt`). `raterId` is the buyer of record when the rating
 * was given and has no foreign key, like `ConsentRecord.actorId`. The mean per household feeds the public
 * profile and the order of the household picker; comments stay private to the buyer.
 */
@Entity({ tableName: 'household_ratings' })
@Unique({ properties: ['request', 'household'] })
@Index({ properties: ['household'] })
export class HouseholdRating extends BaseEntity {
  @ManyToOne({ entity: () => QuotationRequest })
  request!: QuotationRequest;

  @ManyToOne({ entity: () => Household })
  household!: Household;

  @Property({ type: 'uuid' })
  raterId!: string;

  @Property({ type: 'integer' })
  stars!: number;

  @Property({ type: 'string', length: 1000, nullable: true })
  comment?: string | null;
}
