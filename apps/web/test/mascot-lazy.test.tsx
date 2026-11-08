import { act, fireEvent, render } from '@testing-library/react';
import { Mascot } from '@vcraft/ui';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetMascotSpritesForTests } from '../../../packages/ui/src/mascot/sprite-loader';

/**
 * The Fox sprite sheets are not part of the server markup. Stages: none -> base (base sheets start
 * loading, placeholder stays) -> ready (base sheets loaded, placeholder gone, blink sheet preloads) -> all
 * (blink URL set, blinks allowed). A blink never shows before its sheet is cached.
 */
function layers(container: HTMLElement) {
  const get = (name: string) => {
    const el = container.querySelector<HTMLElement>(`[data-layer="${name}"]`);
    if (!el) throw new Error(`missing ${name} layer`);
    return el;
  };
  return { directions: get('directions'), blink: get('blink'), reactions: get('reactions') };
}

const placeholder = (container: HTMLElement) => container.querySelector('[data-placeholder]');
const root = (container: HTMLElement) => container.firstElementChild as HTMLElement;

beforeEach(() => {
  vi.useFakeTimers();
  // Node exposes a PerformanceObserver that jsdom lacks; hide it so the plain idle fallback is tested.
  // The network-quiet tests below stub their own.
  vi.stubGlobal('PerformanceObserver', undefined);
  resetMascotSpritesForTests();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  vi.restoreAllMocks();
  resetMascotSpritesForTests();
});

describe('Mascot lazy sprites', () => {
  it('paints no sheet at first render and shows a placeholder in the fixed-size box', () => {
    const { container } = render(<Mascot size={64} />);
    const { directions, blink, reactions } = layers(container);
    expect(directions.style.backgroundImage).toBe('');
    expect(blink.style.backgroundImage).toBe('');
    expect(reactions.style.backgroundImage).toBe('');
    expect(placeholder(container)).not.toBeNull();
    expect(root(container).style.width).toBe('64px');
    expect(root(container).style.height).toBe('64px');
  });

  it('walks none -> base -> ready -> all on the fallback timers when no load event arrives', () => {
    const { container } = render(<Mascot />);
    const { directions, blink, reactions } = layers(container);

    act(() => {
      fireEvent.pointerEnter(root(container));
    });
    // base: the base sheets start fetching, the placeholder stays until they have arrived.
    expect(directions.style.backgroundImage).toContain('fox-directions.webp');
    expect(reactions.style.backgroundImage).toContain('fox-reactions.webp');
    expect(blink.style.backgroundImage).toBe('');
    expect(placeholder(container)).not.toBeNull();

    // jsdom never fires image load events, so the 2000 ms fallback timers move the stages along.
    act(() => vi.advanceTimersByTime(1_900));
    expect(placeholder(container)).not.toBeNull();
    act(() => vi.advanceTimersByTime(100));
    // ready: placeholder gone, the blink sheet is only being preloaded.
    expect(placeholder(container)).toBeNull();
    expect(blink.style.backgroundImage).toBe('');

    act(() => vi.advanceTimersByTime(2_000));
    // all: the blink layer gets its URL.
    expect(blink.style.backgroundImage).toContain('fox-directions-blink.webp');
  });

  describe('with real image load events', () => {
    const images: HTMLImageElement[] = [];
    beforeEach(() => {
      images.length = 0;
      const RealImage = window.Image;
      vi.stubGlobal(
        'Image',
        class extends RealImage {
          constructor() {
            super();
            images.push(this);
          }
        },
      );
    });
    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('drops the placeholder when both base sheets load, then sets the blink URL once its sheet loads', () => {
      const { container } = render(<Mascot />);
      const { blink } = layers(container);
      act(() => {
        fireEvent.pointerDown(root(container));
      });
      expect(images.map((image) => image.src)).toEqual([
        expect.stringContaining('fox-directions.webp'),
        expect.stringContaining('fox-reactions.webp'),
      ]);

      act(() => images[0]?.onload?.(new Event('load')));
      expect(placeholder(container)).not.toBeNull();
      act(() => images[1]?.onerror?.(new Event('error')));
      expect(placeholder(container)).toBeNull();

      // Only now does the blink sheet start loading, and its URL waits for the load.
      expect(images).toHaveLength(3);
      expect(images[2]?.src).toContain('fox-directions-blink.webp');
      expect(blink.style.backgroundImage).toBe('');
      act(() => images[2]?.onload?.(new Event('load')));
      expect(blink.style.backgroundImage).toContain('fox-directions-blink.webp');
    });
  });

  it('loads the base sheets when the closest focusable ancestor takes focus', () => {
    const { container } = render(
      <button type="button">
        <Mascot />
      </button>,
    );
    const { directions } = layers(container);
    expect(directions.style.backgroundImage).toBe('');
    act(() => {
      container.querySelector('button')?.dispatchEvent(new FocusEvent('focus'));
    });
    expect(directions.style.backgroundImage).toContain('fox-directions.webp');
  });

  it.each([
    ['pointerdown', (): boolean => fireEvent.pointerDown(window)],
    ['keydown', (): boolean => fireEvent.keyDown(window, { key: 'a' })],
  ])('loads the base sheets on the first global %s', (_name, fire) => {
    const { container } = render(<Mascot />);
    const { directions } = layers(container);
    expect(directions.style.backgroundImage).toBe('');
    act(() => {
      fire();
    });
    expect(directions.style.backgroundImage).toContain('fox-directions.webp');
  });

  it('loads the base sheets once the page has been idle, without any interaction', () => {
    const { container } = render(<Mascot />);
    const { directions, reactions, blink } = layers(container);
    act(() => vi.advanceTimersByTime(1_400));
    expect(directions.style.backgroundImage).toBe('');

    act(() => vi.advanceTimersByTime(200));
    expect(directions.style.backgroundImage).toContain('fox-directions.webp');
    expect(reactions.style.backgroundImage).toContain('fox-reactions.webp');
    expect(blink.style.backgroundImage).toBe('');
  });

  it('shares the stage: a mascot mounted later shows its sprites immediately', () => {
    const first = render(<Mascot />);
    act(() => {
      fireEvent.pointerEnter(root(first.container));
    });
    act(() => vi.advanceTimersByTime(4_000));

    const second = render(<Mascot size={96} />);
    const { directions, reactions, blink } = layers(second.container);
    expect(directions.style.backgroundImage).toContain('fox-directions.webp');
    expect(reactions.style.backgroundImage).toContain('fox-reactions.webp');
    expect(blink.style.backgroundImage).toContain('fox-directions-blink.webp');
    expect(placeholder(second.container)).toBeNull();
  });

  it('resumes the blink preload when the only mascot unmounts at `base` and another one mounts', () => {
    const first = render(<Mascot />);
    act(() => {
      fireEvent.pointerEnter(root(first.container));
    });
    first.unmount();
    act(() => vi.advanceTimersByTime(10_000));

    const second = render(<Mascot />);
    const { blink } = layers(second.container);
    act(() => vi.advanceTimersByTime(4_000));
    expect(blink.style.backgroundImage).toContain('fox-directions-blink.webp');
  });

  it('uses custom sheet URLs once loaded', () => {
    const { container } = render(
      <Mascot directions="/custom/dir.webp" reactions="/custom/react.webp" />,
    );
    act(() => {
      fireEvent.pointerEnter(root(container));
    });
    const { directions, reactions } = layers(container);
    expect(directions.style.backgroundImage).toContain('/custom/dir.webp');
    expect(reactions.style.backgroundImage).toContain('/custom/react.webp');
  });

  it('does not show a blink before the blink sheet is ready', () => {
    // Math.random() = 0: first blink after 3 s. The idle fallback sets `base` at 1.5 s, `ready` at 3.5 s
    // and `all` at 5.5 s, so the blink timer fires while the blink sheet is not cached yet.
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const { container } = render(<Mascot reducedMotion={false} />);
    const { directions, blink } = layers(container);

    act(() => vi.advanceTimersByTime(3_050));
    expect(directions.style.backgroundImage).toContain('fox-directions.webp');
    expect(blink.style.backgroundImage).toBe('');
    expect(blink.style.opacity).toBe('0');
    expect(directions.style.opacity).toBe('1');

    // Once the sheet is cached, the blink layer is armed.
    act(() => vi.advanceTimersByTime(2_500));
    expect(blink.style.backgroundImage).toContain('fox-directions-blink.webp');
  });

  describe('network quiet idle trigger', () => {
    let notify: (() => void) | null = null;
    let disconnect = vi.fn();
    beforeEach(() => {
      notify = null;
      disconnect = vi.fn();
      class FakeObserver {
        static supportedEntryTypes = ['resource'];
        constructor(callback: () => void) {
          notify = callback;
        }
        observe = vi.fn();
        disconnect = disconnect;
      }
      vi.stubGlobal('PerformanceObserver', FakeObserver);
    });
    const resourceEntry = () => act(() => notify?.());

    it('keeps postponing while resource entries arrive, then loads after 1 s of quiet', () => {
      const { container } = render(<Mascot />);
      const { directions } = layers(container);
      for (let i = 0; i < 4; i += 1) {
        act(() => vi.advanceTimersByTime(900));
        resourceEntry();
      }
      expect(directions.style.backgroundImage).toBe('');

      // 1 s of quiet, then the idle fallback timer (jsdom has no requestIdleCallback).
      act(() => vi.advanceTimersByTime(1_000));
      expect(directions.style.backgroundImage).toBe('');
      expect(disconnect).toHaveBeenCalled();
      act(() => vi.advanceTimersByTime(1_500));
      expect(directions.style.backgroundImage).toContain('fox-directions.webp');
    });

    it('stops waiting after 8 s even when entries keep coming', () => {
      const { container } = render(<Mascot />);
      const { directions } = layers(container);
      for (let i = 0; i < 9; i += 1) {
        act(() => vi.advanceTimersByTime(800));
        resourceEntry();
      }
      // 7.2 s of constant traffic: still waiting.
      expect(directions.style.backgroundImage).toBe('');
      act(() => vi.advanceTimersByTime(800));
      expect(disconnect).toHaveBeenCalled();
      act(() => vi.advanceTimersByTime(1_500));
      expect(directions.style.backgroundImage).toContain('fox-directions.webp');
    });

    it('still loads immediately on interaction while the network is busy', () => {
      const { container } = render(<Mascot />);
      resourceEntry();
      act(() => {
        fireEvent.pointerEnter(root(container));
      });
      expect(layers(container).directions.style.backgroundImage).toContain('fox-directions.webp');
      expect(disconnect).toHaveBeenCalled();
    });

    it('disconnects the observer when the last mascot unmounts', () => {
      const { unmount } = render(<Mascot />);
      expect(disconnect).not.toHaveBeenCalled();
      unmount();
      expect(disconnect).toHaveBeenCalled();
    });

    it('disconnects the observer on reset', () => {
      render(<Mascot />);
      resetMascotSpritesForTests();
      expect(disconnect).toHaveBeenCalled();
    });
  });

  it('renders no sheet URL in the server markup', () => {
    const html = renderToStaticMarkup(<Mascot />);
    expect(html).not.toMatch(/\.webp|url\(/);
  });
});
