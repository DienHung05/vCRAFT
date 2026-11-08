import { RATING_COMMENT_MAX, RATING_MAX_STARS, RATING_MIN_STARS } from '@vcraft/domain';
import { z } from 'zod';
import { IdSchema, IsoDateTimeSchema } from '../common/primitives';

/**
 * `PUT /rfqs/{id}/ratings/{householdId}` (FR-ORD-11, GH#248 s5-11): the buyer rates one household of a
 * delivered request. The household comes from the path; the body carries the stars and an optional comment.
 */
export const RateHouseholdRequestSchema = z.strictObject({
  stars: z.int().min(RATING_MIN_STARS).max(RATING_MAX_STARS),
  comment: z.string().trim().max(RATING_COMMENT_MAX).optional(),
});
export type RateHouseholdRequest = z.infer<typeof RateHouseholdRequestSchema>;

/** A buyer's rating of one household for one request. Only the owning buyer reads it. */
export const HouseholdRatingSchema = z.strictObject({
  householdId: IdSchema,
  stars: z.int().min(RATING_MIN_STARS).max(RATING_MAX_STARS),
  comment: z.string().nullable(),
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema,
  /** The last moment the buyer can still change this rating. */
  editableUntil: IsoDateTimeSchema,
});
export type HouseholdRatingDto = z.infer<typeof HouseholdRatingSchema>;
