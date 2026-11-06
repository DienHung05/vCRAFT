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
export * from './structured';
