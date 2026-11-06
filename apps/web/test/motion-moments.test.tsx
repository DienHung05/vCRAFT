import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CountUp } from '@/experience/motion/count-up';
import { InkCursor } from '@/experience/motion/ink-cursor';
import {
  countUpValue,
  magneticOffset,
  parseFigure,
  storyDistance,
} from '@/experience/motion/motion-math';

vi.mock('@vcraft/ui', () => ({ useReducedMotion: () => true }));

describe('motion maths (GH#95)', () => {
  it('counts up with an ease-out and lands exactly on the target', () => {
    expect(countUpValue(700, 0, 1400)).toBe(0);
    expect(countUpValue(700, 700, 1400)).toBeGreaterThan(350);
    expect(countUpValue(700, 1400, 1400)).toBe(700);
    expect(countUpValue(700, 5000, 1400)).toBe(700);
  });

  it('reads displayed figures with separators and suffixes', () => {
    expect(parseFigure('1.234')).toEqual({ prefix: '', value: 1234, suffix: '' });
    expect(parseFigure('700+')).toEqual({ prefix: '', value: 700, suffix: '+' });
    expect(parseFigure('—')).toBeNull();
  });

  it('pulls a magnetic button towards the pointer, but never far', () => {
    const box = { left: 0, top: 0, width: 100, height: 40 };
    expect(magneticOffset({ x: 60, y: 20 }, box)).toEqual({ x: 2.5, y: 0 });
    const far = magneticOffset({ x: 1000, y: 1000 }, box);
    expect(Math.hypot(far.x, far.y)).toBeCloseTo(8, 5);
  });

  it('slides the day story by its overflow only', () => {
    expect(storyDistance(2400, 1200)).toBe(1200);
    expect(storyDistance(800, 1200)).toBe(0);
  });
});

describe('under reduced motion', () => {
  it('shows the final figure straight away and renders no ink cursor', () => {
    const { container } = render(
      <>
        <CountUp text="700+" locale="vi" />
        <InkCursor />
      </>,
    );
    expect(screen.getByText('700+')).toBeTruthy();
    expect(container.querySelector('[aria-hidden]')).toBeNull();
  });
});
