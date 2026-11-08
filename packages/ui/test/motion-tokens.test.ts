import { describe, expect, it } from 'vitest';
import { dur, durMs, ease, spring, stagger, staggerDelay } from '../src/motion/tokens';

// Giá trị chuẩn: docs/design/BRAND.md §6.2
describe('motion tokens (BRAND §6.2)', () => {
  it('easing', () => {
    expect(ease.clay).toEqual([0.22, 1, 0.36, 1]);
    expect(ease.kiln).toEqual([0.65, 0, 0.35, 1]);
    expect(ease.press).toEqual([0.34, 1.56, 0.64, 1]);
  });

  it('spring.clay', () => {
    expect(spring.clay).toMatchObject({ stiffness: 260, damping: 26, mass: 0.9 });
  });

  it('thời lượng ms và giây', () => {
    expect(durMs).toEqual({ instant: 90, quick: 160, base: 280, slow: 520, story: 900 });
    expect(dur).toEqual({ instant: 0.09, quick: 0.16, base: 0.28, slow: 0.52, story: 0.9 });
  });

  it('stagger.list 40ms, tối đa 12 phần tử', () => {
    expect(stagger.list.stepMs).toBe(40);
    expect(stagger.list.max).toBe(12);
    expect(staggerDelay(0)).toBe(0);
    expect(staggerDelay(3)).toBeCloseTo(0.12);
    expect(staggerDelay(11)).toBeCloseTo(0.44);
    expect(staggerDelay(50)).toBeCloseTo(0.44);
  });
});
