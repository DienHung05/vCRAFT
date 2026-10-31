import { describe, expect, it } from 'vitest';
import { PROFILE_SECTIONS, profileCompleteness } from '../src/household';

const EMPTY = {
  history: '',
  foundedYear: null,
  generations: null,
  timelineCount: 0,
  certificationCount: 0,
  galleryCount: 0,
  workshopHasLocation: false,
  workshopHasHours: false,
  capacityCategories: 0,
};

describe('profileCompleteness (FR-ART-07)', () => {
  it('hồ sơ trống là 0% và thiếu mọi mục', () => {
    expect(profileCompleteness(EMPTY)).toEqual({ percent: 0, missing: [...PROFILE_SECTIONS] });
  });

  it('câu chuyện quá ngắn chưa được tính; số đời phải đi cùng năm thành lập', () => {
    const { missing } = profileCompleteness({
      ...EMPTY,
      history: 'Ngắn.',
      foundedYear: 1962,
    });
    expect(missing).toContain('story');
    expect(missing).toContain('lineage');
  });

  it('điền một phần cho phần trăm tương ứng, đủ cả là 100%', () => {
    expect(profileCompleteness({ ...EMPTY, timelineCount: 1, galleryCount: 2 }).percent).toBe(25);
    expect(
      profileCompleteness({
        history: 'x'.repeat(80),
        foundedYear: 1962,
        generations: 5,
        timelineCount: 1,
        certificationCount: 1,
        galleryCount: 1,
        workshopHasLocation: true,
        workshopHasHours: true,
        capacityCategories: 1,
      }),
    ).toEqual({ percent: 100, missing: [] });
  });
});
