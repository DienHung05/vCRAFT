import { act, fireEvent, render, renderHook } from '@testing-library/react';
import {
  DIZZY_MS,
  Mascot,
  NO_POKES,
  POKE_MS,
  POKE_WINDOW_MS,
  registerPoke,
  useMascotPoke,
} from '@vcraft/ui';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/** GH#211: rapid clicks on the Fox make it dizzy for a moment; single clicks get a short surprised look. */
describe('registerPoke', () => {
  it('turns the fourth poke within the window into the dizzy face, then starts a new count', () => {
    let state = NO_POKES;
    const reactions: string[] = [];
    for (const at of [0, 300, 600, 900]) {
      const next = registerPoke(state, at);
      state = next.state;
      reactions.push(next.reaction);
    }
    expect(reactions).toEqual(['surprised', 'surprised', 'surprised', 'dizzy']);
    expect(state).toEqual({ times: [], dizzyUntil: 900 + DIZZY_MS });
  });

  it('forgets pokes older than the window, so slow clicks never make it dizzy', () => {
    let state = NO_POKES;
    for (let i = 0; i < 10; i++) {
      const next = registerPoke(state, i * (POKE_WINDOW_MS / 2 + 10));
      expect(next.reaction).toBe('surprised');
      expect(next.holdMs).toBe(POKE_MS);
      state = next.state;
    }
  });

  it('keeps the dizzy face for pokes while dizzy without extending it', () => {
    const dizzy = { times: [], dizzyUntil: 2_000 };
    expect(registerPoke(dizzy, 1_500)).toEqual({ state: dizzy, reaction: 'dizzy', holdMs: 500 });
    expect(registerPoke(dizzy, 2_000).reaction).toBe('surprised');
  });
});

describe('useMascotPoke', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('shows the dizzy face after four quick pokes and goes back to normal', () => {
    const { result } = renderHook(() => useMascotPoke());
    act(() => result.current.poke());
    expect(result.current.reaction).toBe('surprised');
    for (let i = 0; i < 3; i++) {
      act(() => vi.advanceTimersByTime(200));
      act(() => result.current.poke());
    }
    expect(result.current.reaction).toBe('dizzy');
    act(() => vi.advanceTimersByTime(DIZZY_MS - 1));
    expect(result.current.reaction).toBe('dizzy');
    act(() => vi.advanceTimersByTime(1));
    expect(result.current.reaction).toBeNull();
  });
});

describe('<Mascot reaction>', () => {
  it('shows the reaction cell and wobbles only when motion is allowed', () => {
    const { container, rerender } = render(<Mascot reaction="dizzy" reducedMotion={false} />);
    const root = container.firstElementChild as HTMLElement;
    const reactions = container.querySelector<HTMLElement>('[data-layer="reactions"]');
    expect(root.dataset.reaction).toBe('dizzy');
    expect(reactions?.style.opacity).toBe('1');
    expect(container.innerHTML).toMatch(/wobble 0\.9s/);
    rerender(<Mascot reaction="dizzy" reducedMotion />);
    expect(container.innerHTML).not.toMatch(/wobble 0\.9s/);
    expect(reactions?.style.opacity).toBe('1');
  });

  it('is cosmetic: the click still reaches the caller', () => {
    const onClick = vi.fn();
    const { getByRole } = render(
      <button type="button" onClick={onClick}>
        <Mascot reaction="surprised" label="Fox" />
      </button>,
    );
    fireEvent.click(getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
