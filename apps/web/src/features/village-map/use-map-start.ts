import { useCallback, useEffect, useState } from 'react';

/** After the page has loaded, the map starts on its own once the main thread has been idle this long (ms). */
export const MAP_IDLE_START_MS = 2500;

/** The first of these means the visitor is here to use the page: start the map at once. */
const INTENT_EVENTS = ['pointerdown', 'keydown', 'touchstart', 'wheel'] as const;

/**
 * Gate for booting MapLibre (GH#481). Booting it parses the style, spins up workers and adds the layers, which
 * blocks the main thread for seconds on a phone; doing that during the first paint delays the list the visitor
 * can already read. So the map waits, and starts when the first of these happens: `start()` is called (the
 * placeholder button, a deep link), the visitor touches the page, or the page has been loaded and quiet for
 * {@link MAP_IDLE_START_MS}. `enabled` is false until the browser is known to support WebGL.
 */
export function useMapStart(
  enabled: boolean,
  startNow: boolean,
): [started: boolean, start: () => void] {
  const [started, setStarted] = useState(startNow);
  const start = useCallback(() => setStarted(true), []);

  useEffect(() => {
    if (!enabled || started) return;
    let timer: number | undefined;
    const arm = () => {
      timer = window.setTimeout(() => {
        if (typeof window.requestIdleCallback === 'function') {
          window.requestIdleCallback(start, { timeout: MAP_IDLE_START_MS });
        } else {
          start();
        }
      }, MAP_IDLE_START_MS);
    };
    if (document.readyState === 'complete') arm();
    else window.addEventListener('load', arm, { once: true });
    for (const name of INTENT_EVENTS)
      window.addEventListener(name, start, { once: true, passive: true });
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('load', arm);
      for (const name of INTENT_EVENTS) window.removeEventListener(name, start);
    };
  }, [enabled, started, start]);

  return [started, start];
}
