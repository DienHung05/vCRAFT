import { act, fireEvent, render } from '@testing-library/react';
import { Mascot } from '@vcraft/ui';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * GH#203: the Fox turns toward the pointer, also under `prefers-reduced-motion` (a head turn is an
 * instant swap of sprite cells), and looks straight ahead while asleep.
 */
function directions(container: HTMLElement) {
  const el = container.querySelector<HTMLElement>('[data-layer="directions"]');
  if (!el) throw new Error('missing directions layer');
  return el;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
    cb(0);
    return 0;
  });
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('Mascot gaze (GH#203)', () => {
  it.each([false, true])('follows the pointer (reduced motion: %s)', (reducedMotion) => {
    const { container } = render(<Mascot lookAt="pointer" reducedMotion={reducedMotion} />);
    expect(directions(container).style.backgroundPosition).toBe('50% 50%');

    act(() => {
      fireEvent.pointerMove(window, { clientX: -500, clientY: -500 });
    });
    expect(directions(container).style.backgroundPosition).toBe('0% 0%');

    act(() => {
      fireEvent.pointerMove(window, { clientX: 500, clientY: 500 });
    });
    expect(directions(container).style.backgroundPosition).toBe('100% 100%');
  });

  it('keeps no breathing animation under reduced motion while it turns', () => {
    const { container } = render(<Mascot lookAt="pointer" reducedMotion />);
    expect(container.innerHTML).not.toMatch(/breathe \d/);
  });
});
