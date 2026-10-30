/** Tin tức làng nghề: phân loại và vòng đời xuất bản (vCRAFT-83g). */

/** Tin chung của làng nghề hoặc tin riêng của một hộ. */
export const NEWS_CATEGORIES = ['HOUSEHOLD_UPDATE', 'VILLAGE_EVENT', 'CRAFT_STORY'] as const;
export type NewsCategory = (typeof NEWS_CATEGORIES)[number];

export const NEWS_STATUSES = ['DRAFT', 'PUBLISHED'] as const;
export type NewsStatus = (typeof NEWS_STATUSES)[number];
