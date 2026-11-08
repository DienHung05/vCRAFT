import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Reveal, staggerDelay } from '@/experience/motion/reveal';

const motion = vi.hoisted(() => ({ allowed: true }));
vi.mock('@/experience/motion/use-motion', () => ({ useRichMotion: () => motion.allowed }));

let trigger: (() => void) | null = null;

beforeEach(() => {
  motion.allowed = true;
  trigger = null;
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
    top: 5_000,
  } as DOMRect);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function stubObserver() {
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      constructor(cb: (entries: { isIntersecting: boolean }[]) => void) {
        trigger = () => cb([{ isIntersecting: true }]);
      }
      observe() {}
      disconnect() {}
    },
  );
}

describe('Reveal', () => {
  it('adds no animation classes when rich motion is not allowed (reduced motion)', () => {
    stubObserver();
    motion.allowed = false;
    render(<Reveal>content</Reveal>);
    const el = screen.getByText('content');
    expect(el.className).not.toContain('reveal');
  });

  it('keeps content visible when IntersectionObserver is absent', () => {
    vi.stubGlobal('IntersectionObserver', undefined);
    render(<Reveal>content</Reveal>);
    expect(screen.getByText('content').className).not.toContain('reveal');
  });

  it('does not hide a block that starts on screen', () => {
    stubObserver();
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      top: 10,
    } as DOMRect);
    render(<Reveal>content</Reveal>);
    expect(screen.getByText('content').className).not.toContain('reveal');
  });

  it('arms a block below the fold and reveals it on intersection, with a stagger delay', () => {
    stubObserver();
    render(
      <Reveal delay={140} className="card">
        content
      </Reveal>,
    );
    const el = screen.getByText('content');
    expect(el.className).toBe('card reveal');
    act(() => trigger?.());
    expect(el.className).toBe('card reveal reveal-in');
    expect(el.style.getPropertyValue('--reveal-delay')).toBe('140ms');
  });

  it('renders the requested tag', () => {
    render(
      <ul>
        <Reveal as="li">item</Reveal>
      </ul>,
    );
    expect(screen.getByRole('listitem').textContent).toBe('item');
  });
});

describe('staggerDelay', () => {
  it('restarts the ripple every row', () => {
    expect([0, 1, 3, 4, 5].map((i) => staggerDelay(i))).toEqual([0, 70, 210, 0, 70]);
  });
});
