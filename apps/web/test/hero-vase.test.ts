import { describe, expect, it } from 'vitest';
import { canRun3d } from '@/experience/hero-vase/capability';
import {
  kilnGlow,
  morphProfile,
  PROFILES,
  paintProgress,
  scrollProgress,
} from '@/experience/hero-vase/vase-profiles';

describe('hero vase profiles (GH#94)', () => {
  it('has four profiles sampled at the same heights', () => {
    expect(PROFILES).toHaveLength(4);
    const heights = PROFILES.map((p) => p.map(([, y]) => y).join());
    expect(new Set(heights).size).toBe(1);
  });

  it('starts as clay, ends as the money jar, and blends in between', () => {
    expect(morphProfile(0)).toEqual(PROFILES[0]);
    expect(morphProfile(1)).toEqual(PROFILES[3]);
    expect(morphProfile(-1)).toEqual(PROFILES[0]);
    const mid = morphProfile(1 / 6);
    const [r0] = PROFILES[0]?.[10] ?? [0];
    const [r1] = PROFILES[1]?.[10] ?? [0];
    expect(mid[10]?.[0]).toBeGreaterThan(Math.min(r0, r1));
    expect(mid[10]?.[0]).toBeLessThan(Math.max(r0, r1));
  });

  it('paints the glaze late and glows only in the middle of the scroll', () => {
    expect(paintProgress(0.2)).toBe(0);
    expect(paintProgress(1)).toBe(1);
    expect(kilnGlow(0)).toBe(0);
    expect(kilnGlow(0.6)).toBeGreaterThan(0.9);
    expect(kilnGlow(1)).toBeCloseTo(0, 5);
  });

  it('measures scroll progress through the hero', () => {
    expect(scrollProgress(0, 800)).toBe(0);
    expect(scrollProgress(-400, 800)).toBe(0.5);
    expect(scrollProgress(-2000, 800)).toBe(1);
    expect(scrollProgress(100, 0)).toBe(0);
  });
});

describe('when the 3D vase runs', () => {
  const capable = {
    reducedMotion: false,
    saveData: false,
    webgl: true,
    cores: 8,
    memoryGb: 8,
    width: 1280,
  };

  it('runs on a capable desktop', () => {
    expect(canRun3d(capable)).toBe(true);
  });

  it.each([
    ['reduced motion', { reducedMotion: true }],
    ['data saver', { saveData: true }],
    ['no WebGL', { webgl: false }],
    ['few cores', { cores: 2 }],
    ['little memory', { memoryGb: 2 }],
    ['a phone-width screen', { width: 390 }],
  ])('keeps the turning vase with %s', (_, over) => {
    expect(canRun3d({ ...capable, ...over })).toBe(false);
  });

  it('does not hold an unknown memory size against the device', () => {
    expect(canRun3d({ ...capable, memoryGb: undefined })).toBe(true);
  });
});
