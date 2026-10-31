/** Độ hoàn thiện hồ sơ hộ (FR-ART-07): mỗi mục đủ được tính ngang nhau, kèm danh sách mục còn thiếu. */
export const PROFILE_SECTIONS = [
  'story',
  'lineage',
  'timeline',
  'certifications',
  'gallery',
  'workshopLocation',
  'openingHours',
  'capacity',
] as const;
export type ProfileSection = (typeof PROFILE_SECTIONS)[number];

export interface ProfileFacts {
  readonly history: string;
  readonly foundedYear: number | null;
  readonly generations: number | null;
  readonly timelineCount: number;
  readonly certificationCount: number;
  readonly galleryCount: number;
  readonly workshopHasLocation: boolean;
  readonly workshopHasHours: boolean;
  readonly capacityCategories: number;
}

/** Một câu chuyện đủ đọc: ngắn hơn thì coi như chưa viết. */
const MIN_STORY_LENGTH = 80;

export function profileCompleteness(facts: ProfileFacts): {
  percent: number;
  missing: ProfileSection[];
} {
  const done: Record<ProfileSection, boolean> = {
    story: facts.history.trim().length >= MIN_STORY_LENGTH,
    lineage: facts.foundedYear !== null && facts.generations !== null,
    timeline: facts.timelineCount > 0,
    certifications: facts.certificationCount > 0,
    gallery: facts.galleryCount > 0,
    workshopLocation: facts.workshopHasLocation,
    openingHours: facts.workshopHasHours,
    capacity: facts.capacityCategories > 0,
  };
  const missing = PROFILE_SECTIONS.filter((section) => !done[section]);
  const filled = PROFILE_SECTIONS.length - missing.length;
  return { percent: Math.round((filled / PROFILE_SECTIONS.length) * 100), missing };
}
