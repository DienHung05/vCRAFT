import { act, render } from '@testing-library/react';
import { Mascot } from '@vcraft/ui';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * GH#186: a blink swaps the current gaze cell for its closed-eye twin on the blink sheet. The head keeps
 * facing where it looks, the reactions layer stays hidden, and there is no cross-fade on the blink layer.
 */
function layers(container: HTMLElement) {
  const get = (name: string) => {
    const el = container.querySelector<HTMLElement>(`[data-layer="${name}"]`);
    if (!el) throw new Error(`missing ${name} layer`);
    return el;
  };
  return { directions: get('directions'), blink: get('blink'), reactions: get('reactions') };
}

// Math.random() = 0.5: first blink after 4.5 s, never a double blink.
beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(Math, 'random').mockReturnValue(0.5);
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('Mascot blink (GH#186)', () => {
  it.each([
    [{ x: -500, y: -500 }, '0% 0%'],
    [{ x: 500, y: -500 }, '100% 0%'],
    [{ x: -500, y: 0 }, '0% 50%'],
    [{ x: 0, y: 500 }, '50% 100%'],
  ])('keeps the gaze cell while blinking (look at %o)', (lookAt, cell) => {
    const { container } = render(<Mascot lookAt={lookAt} reducedMotion={false} />);
    const { directions, blink, reactions } = layers(container);
    expect(directions.style.backgroundPosition).toBe(cell);
    expect(blink.style.opacity).toBe('0');

    act(() => vi.advanceTimersByTime(4_500));
    expect(blink.style.opacity).toBe('1');
    expect(blink.style.backgroundPosition).toBe(cell);
    expect(blink.style.backgroundImage).toContain('fox-directions-blink.webp');
    expect(blink.style.transition).toBe('');
    expect(directions.style.backgroundPosition).toBe(cell);
    expect(directions.style.opacity).toBe('1');
    expect(reactions.style.opacity).toBe('0');

    act(() => vi.advanceTimersByTime(120));
    expect(blink.style.opacity).toBe('0');
  });

  it('never shows the blink layer during a mood reaction', () => {
    const { container } = render(<Mascot mood="greet" reducedMotion={false} />);
    const { blink, reactions } = layers(container);
    expect(reactions.style.opacity).toBe('1');
    act(() => vi.advanceTimersByTime(20_000));
    expect(blink.style.opacity).toBe('0');
  });

  it('does not blink under reduced motion', () => {
    const { container } = render(<Mascot reducedMotion />);
    const { blink } = layers(container);
    act(() => vi.advanceTimersByTime(20_000));
    expect(blink.style.opacity).toBe('0');
  });
});
