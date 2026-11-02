import { act, render, renderHook, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { onKilnBurst } from '@/features/auth/kiln/kiln-bus';
import { canMountEffects, KilnEffects } from '@/features/auth/kiln/kiln-effects';
import { useKilnFeedback } from '@/features/auth/kiln/kiln-feedback';
import { KilnSurface } from '@/features/auth/kiln/kiln-surface';

vi.mock('next/dynamic', () => ({
  // The real loader fetches the canvas chunk; the stub only shows whether it was asked to mount.
  default: () =>
    function CanvasStub() {
      return <div data-testid="kiln-canvas" />;
    },
}));

function stubMatchMedia(matches: Record<string, boolean>) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: matches[query] ?? false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
}

const calm = { '(prefers-reduced-motion: reduce)': false, '(pointer: fine)': false };

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('useKilnFeedback outside the shell', () => {
  it('is all no-ops, and seal resolves at once', async () => {
    const { result } = renderHook(() => useKilnFeedback());
    expect(() => {
      result.current.fire();
      result.current.fail();
      result.current.reset();
    }).not.toThrow();
    await expect(result.current.seal()).resolves.toBeUndefined();
  });
});

/** jsdom has no PageTransitionEvent; the handler only reads `persisted`. */
class PageTransitionEventStub extends Event {
  persisted: boolean;
  constructor(type: string, persisted: boolean) {
    super(type);
    this.persisted = persisted;
  }
}

let feedback: ReturnType<typeof useKilnFeedback>;

/** Hands the card's feedback to the test. */
function Probe() {
  feedback = useKilnFeedback();
  return null;
}

describe('useKilnFeedback inside the kiln card', () => {
  /** A scene with the seal, a card with a submit button, a crackle layer and the status line. */
  function renderCard() {
    return render(
      <div className="kiln-scene">
        <div className="kiln-seal" />
        <KilnSurface className="kiln-card" data-testid="card">
          <Probe />
          <button type="submit">Go</button>
          <div className="kiln-crackle-fade" data-testid="crackle" />
          <p role="status" data-kiln-status="" data-text="Sealed. Opening the kiln…" />
        </KilnSurface>
      </div>,
    );
  }

  const card = () => screen.getByTestId('card');
  const seal = () => document.querySelector('.kiln-seal');

  beforeEach(() => {
    stubMatchMedia(calm);
  });

  it('fire: sets the firing state, heats the seal and streams embers from the button to the seal', () => {
    renderCard();
    const burst = vi.fn();
    const stop = onKilnBurst(burst);
    act(() => feedback.fire());
    stop();
    expect(card().getAttribute('data-kiln-state')).toBe('firing');
    expect(seal()?.getAttribute('data-kiln')).toBe('hot');
    expect(burst).toHaveBeenCalledTimes(1);
    expect(burst.mock.calls[0]?.[0]).toHaveProperty('from');
    expect(burst.mock.calls[0]?.[0]).toHaveProperty('to');
  });

  it('fire without a listening island is a no-op beyond the attributes', () => {
    renderCard();
    expect(() => act(() => feedback.fire())).not.toThrow();
  });

  it('fail: replays the error animation every time, and clears it when the crackle ends', () => {
    renderCard();
    const states: (string | null)[] = [];
    const watch = new MutationObserver((records) => {
      for (const record of records) states.push(card().getAttribute(record.attributeName ?? ''));
    });
    watch.observe(card(), { attributes: true, attributeFilter: ['data-kiln-state'] });

    act(() => feedback.fail());
    expect(card().getAttribute('data-kiln-state')).toBe('error');
    expect(seal()?.getAttribute('data-kiln')).toBe('cool');
    act(() => feedback.fail());
    watch.takeRecords();
    // The attribute was removed and re-added between the two calls (that is what restarts the animation).
    expect(card().getAttribute('data-kiln-state')).toBe('error');

    act(() => {
      screen.getByTestId('crackle').dispatchEvent(new Event('animationend', { bubbles: true }));
    });
    expect(card().hasAttribute('data-kiln-state')).toBe(false);
    watch.disconnect();
  });

  it('fail removes the state before re-adding it', () => {
    renderCard();
    const removed = vi.spyOn(card(), 'removeAttribute');
    act(() => feedback.fail());
    act(() => feedback.fail());
    expect(
      removed.mock.calls.filter(([name]) => name === 'data-kiln-state').length,
    ).toBeGreaterThanOrEqual(2);
  });

  it('fail clears itself after the backstop even if no animation ends', () => {
    vi.useFakeTimers();
    renderCard();
    act(() => feedback.fail());
    expect(card().getAttribute('data-kiln-state')).toBe('error');
    act(() => {
      vi.advanceTimersByTime(1600);
    });
    expect(card().hasAttribute('data-kiln-state')).toBe(false);
  });

  it('seal: stamps, announces the success line, and resolves after the 520ms hold', async () => {
    vi.useFakeTimers();
    renderCard();
    let resolved = false;
    act(() => {
      void feedback.seal().then(() => {
        resolved = true;
      });
    });
    expect(card().getAttribute('data-kiln-state')).toBe('sealed');
    expect(screen.getByRole('status').textContent).toBe('Sealed. Opening the kiln…');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(519);
    });
    expect(resolved).toBe(false);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(resolved).toBe(true);
  });

  it('seal under reduced motion holds only the 150ms fade', async () => {
    stubMatchMedia({ ...calm, '(prefers-reduced-motion: reduce)': true });
    vi.useFakeTimers();
    renderCard();
    let resolved = false;
    act(() => {
      void feedback.seal().then(() => {
        resolved = true;
      });
    });
    expect(card().getAttribute('data-kiln-state')).toBe('sealed');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(149);
    });
    expect(resolved).toBe(false);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(resolved).toBe(true);
  });

  describe('a seal interrupted during its hold still settles, so the caller never hangs', () => {
    for (const [name, interrupt] of [
      ['reset', () => feedback.reset()],
      ['fail', () => feedback.fail()],
      ['fire', () => feedback.fire()],
    ] as const) {
      it(`${name}() settles the pending seal`, async () => {
        vi.useFakeTimers();
        renderCard();
        let resolved = false;
        act(() => {
          void feedback.seal().then(() => {
            resolved = true;
          });
        });
        expect(resolved).toBe(false);
        await act(async () => {
          interrupt();
          await Promise.resolve();
        });
        expect(resolved).toBe(true);
      });
    }

    it('a second seal() settles the first', async () => {
      vi.useFakeTimers();
      renderCard();
      const first = vi.fn();
      act(() => {
        void feedback.seal().then(first);
        void feedback.seal();
      });
      await act(async () => {
        await Promise.resolve();
      });
      expect(first).toHaveBeenCalled();
    });
  });

  it('seal marks the leaving document for the view transition, and leaving the state unmarks it', () => {
    renderCard();
    act(() => {
      void feedback.seal();
    });
    expect(document.documentElement.dataset.kilnVt).toBe('1');
    act(() => feedback.fail());
    expect(document.documentElement.dataset.kilnVt).toBeUndefined();
  });

  it('seal sends a second, quick burst so the embers land with the stamp', () => {
    renderCard();
    const burst = vi.fn();
    const stop = onKilnBurst(burst);
    act(() => {
      void feedback.seal();
    });
    stop();
    expect(burst).toHaveBeenCalledTimes(1);
    expect(burst.mock.calls[0]?.[0]).toMatchObject({ quick: true });
  });

  it("fail('invalid') is the light reaction: shake only, no crackle state, the seal keeps its mood", () => {
    renderCard();
    act(() => feedback.fail('invalid'));
    expect(card().getAttribute('data-kiln-state')).toBe('invalid');
    expect(seal()?.hasAttribute('data-kiln')).toBe(false);
    act(() => {
      card().dispatchEvent(new Event('animationend'));
    });
    expect(card().hasAttribute('data-kiln-state')).toBe(false);
  });

  it('the error clearing itself also resets the seal mood', () => {
    renderCard();
    act(() => feedback.fail());
    expect(seal()?.getAttribute('data-kiln')).toBe('cool');
    act(() => {
      screen.getByTestId('crackle').dispatchEvent(new Event('animationend', { bubbles: true }));
    });
    expect(seal()?.hasAttribute('data-kiln')).toBe(false);
  });

  it('a page restored from the back/forward cache is reset, not left stamped', () => {
    renderCard();
    act(() => {
      void feedback.seal();
    });
    expect(card().getAttribute('data-kiln-state')).toBe('sealed');
    // A normal load is not a restore.
    act(() => {
      window.dispatchEvent(new PageTransitionEventStub('pageshow', false));
    });
    expect(card().getAttribute('data-kiln-state')).toBe('sealed');
    act(() => {
      window.dispatchEvent(new PageTransitionEventStub('pageshow', true));
    });
    expect(card().hasAttribute('data-kiln-state')).toBe(false);
    expect(screen.getByRole('status').textContent).toBe('');
  });

  it('reset: clears the state, the seal mood and the success line', () => {
    renderCard();
    act(() => {
      void feedback.seal();
    });
    act(() => feedback.fire());
    act(() => feedback.reset());
    expect(card().hasAttribute('data-kiln-state')).toBe(false);
    expect(seal()?.hasAttribute('data-kiln')).toBe(false);
    expect(screen.getByRole('status').textContent).toBe('');
  });
});

describe('speculation rules while the seal plays', () => {
  const rules = () => document.querySelector<HTMLScriptElement>('script[type="speculationrules"]');

  function stubSupport(supported: boolean, saveData = false) {
    vi.stubGlobal('HTMLScriptElement', Object.assign(HTMLScriptElement, {}));
    HTMLScriptElement.supports = ((type: string) =>
      supported && type === 'speculationrules') as never;
    Object.defineProperty(navigator, 'connection', { value: { saveData }, configurable: true });
  }

  function renderSealed() {
    render(
      <div className="kiln-scene">
        <div className="kiln-seal" />
        <KilnSurface className="kiln-card" data-testid="card">
          <Probe />
          <button type="submit">Go</button>
        </KilnSurface>
      </div>,
    );
  }

  beforeEach(() => {
    stubMatchMedia(calm);
    stubSupport(true);
  });
  afterEach(() => {
    document.querySelector('script[type="speculationrules"]')?.remove();
    delete (HTMLScriptElement as { supports?: unknown }).supports;
    delete (navigator as { connection?: unknown }).connection;
  });

  it('seal(url) inserts one eager prerender rule for exactly that URL', () => {
    renderSealed();
    act(() => {
      void feedback.seal('/auth/continue?locale=vi');
    });
    expect(document.querySelectorAll('script[type="speculationrules"]')).toHaveLength(1);
    expect(JSON.parse(rules()?.textContent ?? '{}')).toEqual({
      prerender: [{ urls: ['/auth/continue?locale=vi'], eagerness: 'immediate' }],
    });
  });

  it('inserts nothing without a destination, without support, or when saving data', () => {
    renderSealed();
    act(() => {
      void feedback.seal();
    });
    expect(rules()).toBeNull();
    stubSupport(false);
    act(() => {
      void feedback.seal('/vi/x');
    });
    expect(rules()).toBeNull();
    stubSupport(true, true);
    act(() => {
      void feedback.seal('/vi/x');
    });
    expect(rules()).toBeNull();
  });

  it('is withdrawn on reset, on fail, on fire, and when the page is restored from the cache', () => {
    renderSealed();
    for (const leave of [
      () => feedback.reset(),
      () => feedback.fail(),
      () => feedback.fire(),
      () => window.dispatchEvent(new PageTransitionEventStub('pageshow', true)),
    ]) {
      act(() => {
        void feedback.seal('/vi/x');
      });
      expect(rules()).not.toBeNull();
      act(() => leave());
      expect(rules()).toBeNull();
    }
  });

  it('a second seal() replaces the rule instead of stacking another', () => {
    renderSealed();
    act(() => {
      void feedback.seal('/vi/a');
      void feedback.seal('/vi/b');
    });
    expect(document.querySelectorAll('script[type="speculationrules"]')).toHaveLength(1);
    expect(rules()?.textContent).toContain('/vi/b');
  });
});

describe('KilnEffects loader', () => {
  function stubWebGL(available: boolean) {
    const lose = { loseContext: vi.fn() };
    const context = { getExtension: () => lose };
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(((kind: string) =>
      available && kind === 'webgl2' ? context : null) as never);
  }

  /** Idle callbacks run as soon as they are scheduled. */
  function stubIdle() {
    vi.stubGlobal('requestIdleCallback', (cb: () => void) => {
      cb();
      return 1;
    });
    vi.stubGlobal('cancelIdleCallback', () => {});
  }

  afterEach(() => vi.restoreAllMocks());

  it('mounts the canvas after idle when motion is allowed, the tab is visible and WebGL exists', () => {
    stubMatchMedia(calm);
    stubIdle();
    stubWebGL(true);
    render(<KilnEffects />);
    expect(screen.queryByTestId('kiln-canvas')).not.toBeNull();
  });

  it('does not mount under reduced motion', () => {
    stubMatchMedia({ ...calm, '(prefers-reduced-motion: reduce)': true });
    stubIdle();
    stubWebGL(true);
    render(<KilnEffects />);
    expect(screen.queryByTestId('kiln-canvas')).toBeNull();
  });

  it('does not mount without WebGL', () => {
    stubMatchMedia(calm);
    stubIdle();
    stubWebGL(false);
    render(<KilnEffects />);
    expect(screen.queryByTestId('kiln-canvas')).toBeNull();
  });

  it('does not mount before the browser is idle', () => {
    stubMatchMedia(calm);
    vi.stubGlobal('requestIdleCallback', () => 1);
    vi.stubGlobal('cancelIdleCallback', () => {});
    stubWebGL(true);
    render(<KilnEffects />);
    expect(screen.queryByTestId('kiln-canvas')).toBeNull();
  });

  it('canMountEffects also refuses a hidden tab', () => {
    stubMatchMedia(calm);
    stubWebGL(true);
    expect(canMountEffects()).toBe(true);
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    expect(canMountEffects()).toBe(false);
  });
});
