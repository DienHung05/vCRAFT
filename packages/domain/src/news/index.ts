/** Tin tức làng nghề: phân loại và vòng đời xuất bản (vCRAFT-83g). */

/** Tin chung của làng nghề hoặc tin riêng của một hộ. */
export const NEWS_CATEGORIES = [
  'HOUSEHOLD_UPDATE',
  'VILLAGE_EVENT',
  'CRAFT_STORY',
  'MATERIAL_PRICES',
  'POWER_SCHEDULE',
  'SUPPORT_POLICY',
  'GENERAL',
] as const;
export type NewsCategory = (typeof NEWS_CATEGORIES)[number];

export const NEWS_STATUSES = ['DRAFT', 'PUBLISHED'] as const;
export type NewsStatus = (typeof NEWS_STATUSES)[number];

/** `VILLAGE` is only readable by approved households and administrators (FR-NEWS-02). */
export const NEWS_VISIBILITIES = ['PUBLIC', 'VILLAGE'] as const;
export type NewsVisibility = (typeof NEWS_VISIBILITIES)[number];
/**
 * Where an item came from. Only administrators see it (GH#314): `IMPORTED` items come from the worker's
 * feed import, `GENERATED` ones are evergreen articles written by the LLM filler.
 */
export const NEWS_ORIGINS = ['MANUAL', 'IMPORTED', 'GENERATED'] as const;
export type NewsOrigin = (typeof NEWS_ORIGINS)[number];

export * from './structured';
