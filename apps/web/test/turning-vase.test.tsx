import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { act, render } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { afterFirstFrame } from '@/experience/hero-vase/first-frame';
import { HERO_PROFILE, silhouette } from '@/experience/hero-vase/silhouette';
import { TurningVase } from '@/experience/hero-vase/turning-vase';

const scene = vi.hoisted(() => ({ onReady: undefined as (() => void) | undefined }));
const facts = vi.hoisted(() => ({ capable: true }));

vi.mock('next/dynamic', () => ({
  default: () =>
    function MockScene({ onReady }: { onReady: () => void }) {
      scene.onReady = onReady;
      return <canvas data-testid="mock-canvas" />;
    },
}));
vi.mock('@/experience/hero-vase/vase-scene', () => ({ default: () => null }));
vi.mock('@/experience/hero-vase/capability', () => ({
  canRun3d: () => facts.capable,
  readDeviceFacts: () => ({}),
}));

import { HeroVase } from '@/experience/hero-vase/hero-vase';

describe('turning vase (GH#316)', () => {
  it('is server-rendered with the turning layers and no JavaScript needed', () => {
    const html = renderToString(<TurningVase />);
    expect(html).toContain('data-testid="turning-vase"');
    expect(html).toContain('turning-vase-spin');
    expect(html).toContain('turning-vase-glint');
    expect(html).toContain('clip-path="url(#turning-vase-clip)"');
  });

  it('draws the silhouette from the 3D scene profile', () => {
    const { rings, topY, footY } = silhouette(HERO_PROFILE);
    expect(rings).toHaveLength(HERO_PROFILE.length - 1);
    expect(footY).toBeGreaterThan(topY);
    const widest = Math.max(...HERO_PROFILE.map(([r]) => r));
    const ringWidest = Math.max(...rings.map((r) => Math.max(r.r0, r.r1)));
    // One uniform scale: the widest ring is the widest profile radius times the unit (about 173).
    expect(ringWidest / widest).toBeGreaterThan(150);
    expect(ringWidest / widest).toBeLessThan(200);
    expect(silhouette().path.startsWith('M')).toBe(true);
  });

  it('is what the hero renders, never the flat figure', () => {
    const page = readFileSync(join(process.cwd(), 'src/app/[locale]/(marketing)/page.tsx'), 'utf8');
    expect(page).toContain('<TurningVase');
    expect(page).not.toContain('VaseFigure');
  });

  it('stops turning under reduced motion', () => {
    const css = readFileSync(join(process.cwd(), 'src/styles/globals.css'), 'utf8');
    const block = css.slice(
      css.indexOf('@media (prefers-reduced-motion: reduce) {\n  .turning-vase-spin'),
    );
    expect(css).toContain('translateX(-80px)');
    expect(block.replace(/\r/g, '')).toContain('animation: none');
  });
});

describe('first drawn frame', () => {
  it('hands over once, and only through the scheduler', () => {
    const onReady = vi.fn();
    const queue: (() => void)[] = [];
    const frame = afterFirstFrame(onReady, (cb) => queue.push(cb));
    expect(onReady).not.toHaveBeenCalled();
    frame();
    frame();
    expect(onReady).not.toHaveBeenCalled();
    expect(queue).toHaveLength(1);
    queue[0]?.();
    expect(onReady).toHaveBeenCalledTimes(1);
  });
});

describe('HeroVase hand-over', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    scene.onReady = undefined;
    facts.capable = true;
  });
  afterEach(() => vi.useRealTimers());

  it('renders nothing on devices that cannot run 3D', () => {
    facts.capable = false;
    const { queryByTestId } = render(<HeroVase sectionId="home-hero" />);
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(queryByTestId('hero-vase-3d')).toBeNull();
  });

  it('keeps the canvas hidden until the first frame has been drawn', () => {
    const { getByTestId } = render(<HeroVase sectionId="home-hero" />);
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    const layer = getByTestId('hero-vase-3d');
    expect(layer.className).toContain('opacity-0');
    expect(scene.onReady).toBeTypeOf('function');
    act(() => scene.onReady?.());
    expect(layer.className).toContain('opacity-100');
  });
});
