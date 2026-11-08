import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CountUp } from '@/experience/motion/count-up';
import { InkCursor } from '@/experience/motion/ink-cursor';
import {
  countUpValue,
  magneticOffset,
  parseFigure,
  stageAt,
  stageProgress,
  stageState,
} from '@/experience/motion/motion-math';
import { Reveal } from '@/experience/motion/reveal';

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

  it('puts exactly one day stage in focus for any scroll progress (GH#210)', () => {
    expect([0, 0.09, 0.11, 0.5, 0.91, 1].map((p) => stageAt(p, 6))).toEqual([0, 0, 1, 3, 5, 5]);
    expect(stageAt(-1, 6)).toBe(0);
    expect(stageAt(2, 6)).toBe(5);
    expect(stageAt(0.7, 1)).toBe(0);
    for (let i = 0; i < 6; i++) expect(stageAt(stageProgress(i, 6), 6)).toBe(i);
    expect([0, 1, 2].map((i) => stageState(i, 1))).toEqual(['before', 'active', 'after']);
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

  it('shows revealed content with no armed class (GH#301)', () => {
    const { container } = render(
      <Reveal>
        <p>below the fold</p>
      </Reveal>,
    );
    // Content is present and never hidden when motion is reduced.
    expect(screen.getByText('below the fold')).toBeTruthy();
    const box = container.firstElementChild as HTMLElement;
    expect(box.className).not.toContain('reveal-armed');
    expect(box.className).toContain('reveal-in');
  });
});
