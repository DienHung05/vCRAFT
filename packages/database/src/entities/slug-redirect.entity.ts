import { Entity, Index, Property, Unique } from '@mikro-orm/decorators/legacy';
import { BaseEntity } from './base.entity.js';

/** What a retired slug pointed at. */
export const SLUG_REDIRECT_KINDS = ['PRODUCT', 'HOUSEHOLD'] as const;
export type SlugRedirectKind = (typeof SLUG_REDIRECT_KINDS)[number];

/**
 * A slug a product or household used to have, so shared links keep working after a rename (PLAN E5,
 * FR-PRD). `targetId` is the entity's id, not its slug: a chain of renames needs no rewriting, every
 * old slug resolves straight to the current one.
 */
@Entity({ tableName: 'slug_redirect' })
@Unique({ properties: ['kind', 'oldSlug'] })
@Index({ properties: ['targetId'] })
export class SlugRedirect extends BaseEntity {
  @Property({ type: 'string', length: 20 })
  kind!: SlugRedirectKind;

  @Property({ type: 'string', length: 200 })
  oldSlug!: string;

  @Property({ type: 'uuid' })
  targetId!: string;
}
