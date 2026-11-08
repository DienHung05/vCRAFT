/**
 * Shared, module-level loader for the Fox sprite sheets (about 290 KB in total).
 *
 * The SSR markup never carries the sheet URLs, so the browser does not fetch them at first paint. The
 * loader moves through four stages and every `Mascot` instance reads the same one, so a mascot mounted
 * later (the panel header) shows its sprites immediately:
 *
 * - `none`: nothing may be painted yet (also the server snapshot, which keeps hydration stable).
 * - `base`: the directions and reactions URLs are set on their layers, so the fetch starts. The
 *   placeholder stays up until the sheets have arrived.
 * - `ready`: both base sheets have loaded (or the fallback timer fired): the placeholder goes away, and
 *   the blink sheet starts preloading.
 * - `all`: the blink sheet has loaded (or the fallback timer fired), so its URL is set on the blink layer
 *   and blinks are allowed. A blink can therefore never swap the fox for an empty layer.
 *
 * `none -> base` happens on the first of: the page going idle, or user interaction (pointer, keyboard,
 * or the mascot or its focusable ancestor being touched or focused). "Idle" means window `load`, then
 * 1 s without a new resource timing entry (at most 8 s of waiting), then an idle callback. Our own sheet
 * fetches only start after that, so they cannot postpone it.
 */
import { useSyncExternalStore } from 'react';

export type MascotSpriteStage = 'none' | 'base' | 'ready' | 'all';

export interface MascotSpriteUrls {
  directions: string;
  reactions: string;
  blinks: string;
}

/** Idle fallback where `requestIdleCallback` is missing (Safari, jsdom). */
const IDLE_FALLBACK_MS = 1500;
/** Longest the browser may postpone the idle callback. */
const IDLE_CALLBACK_TIMEOUT_MS = 2000;
/** The page counts as quiet once no resource entry has arrived for this long. */
const NETWORK_QUIET_MS = 1000;
/** Stop waiting for network quiet after this long, so a page that keeps polling still gets its mascot. */
const IDLE_MAX_WAIT_MS = 8000;
/** Move on to the next stage even if no image load event arrives. */
const LOAD_FALLBACK_MS = 2000;

let stage: MascotSpriteStage = 'none';
let urls: MascotSpriteUrls | null = null;
let attached = 0;
let disarmTriggers: (() => void) | null = null;
let cancelPreload: (() => void) | null = null;
const listeners = new Set<() => void>();

function stopPreload() {
  cancelPreload?.();
  cancelPreload = null;
}

function emit() {
  for (const listener of listeners) listener();
}

function setStage(next: MascotSpriteStage) {
  if (next === stage) return;
  stage = next;
  emit();
}

/** True where the browser can report resource timing entries (not in jsdom without a stub). */
function canObserveResources(): boolean {
  return (
    typeof PerformanceObserver !== 'undefined' &&
    PerformanceObserver.supportedEntryTypes?.includes('resource') === true
  );
}

/**
 * Waits for the page to be idle: window `load`, then network quiet (no new resource entry for
 * `NETWORK_QUIET_MS`, capped at `IDLE_MAX_WAIT_MS`), then an idle callback (or a short timer).
 * `requestIdleCallback` alone fires as soon as the main thread is free, which is not the same as the
 * page being done fetching. Without resource timing, the network step is skipped.
 */
function armIdleTrigger(onIdle: () => void): () => void {
  let loadHandler: (() => void) | null = null;
  let idleHandle: number | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let observer: PerformanceObserver | null = null;
  let quietTimer: ReturnType<typeof setTimeout> | null = null;
  let maxTimer: ReturnType<typeof setTimeout> | null = null;

  const stopObserving = () => {
    observer?.disconnect();
    observer = null;
    if (quietTimer !== null) clearTimeout(quietTimer);
    if (maxTimer !== null) clearTimeout(maxTimer);
    quietTimer = null;
    maxTimer = null;
  };

  const whenIdle = () => {
    if (typeof window.requestIdleCallback === 'function') {
      idleHandle = window.requestIdleCallback(onIdle, { timeout: IDLE_CALLBACK_TIMEOUT_MS });
    } else {
      timer = setTimeout(onIdle, IDLE_FALLBACK_MS);
    }
  };

  const whenNetworkQuiet = () => {
    if (!canObserveResources()) {
      whenIdle();
      return;
    }
    const quiet = () => {
      stopObserving();
      whenIdle();
    };
    observer = new PerformanceObserver(() => {
      if (quietTimer !== null) clearTimeout(quietTimer);
      quietTimer = setTimeout(quiet, NETWORK_QUIET_MS);
    });
    observer.observe({ type: 'resource', buffered: false });
    quietTimer = setTimeout(quiet, NETWORK_QUIET_MS);
    maxTimer = setTimeout(quiet, IDLE_MAX_WAIT_MS);
  };

  if (document.readyState === 'complete') {
    whenNetworkQuiet();
  } else {
    loadHandler = () => {
      loadHandler = null;
      whenNetworkQuiet();
    };
    window.addEventListener('load', loadHandler, { once: true });
  }

  return () => {
    if (loadHandler) window.removeEventListener('load', loadHandler);
    stopObserving();
    if (idleHandle !== null && typeof window.cancelIdleCallback === 'function') {
      window.cancelIdleCallback(idleHandle);
    }
    if (timer !== null) clearTimeout(timer);
  };
}

function armTriggers() {
  if (disarmTriggers || typeof window === 'undefined') return;
  const trigger = () => requestMascotSprites();
  const disarmIdle = armIdleTrigger(trigger);
  window.addEventListener('pointerdown', trigger, { passive: true });
  window.addEventListener('keydown', trigger);
  disarmTriggers = () => {
    disarmIdle();
    window.removeEventListener('pointerdown', trigger);
    window.removeEventListener('keydown', trigger);
    disarmTriggers = null;
  };
}

/** Loads every source with `new Image()`, then calls `done` (on load or error, or after the fallback). */
function preload(sources: readonly string[], done: () => void): () => void {
  let pending = sources.length;
  let finished = false;
  const images: HTMLImageElement[] = [];
  const timer = setTimeout(() => finish(), LOAD_FALLBACK_MS);
  function finish() {
    if (finished) return;
    finished = true;
    clearTimeout(timer);
    done();
  }
  const settle = () => {
    pending -= 1;
    if (pending <= 0) finish();
  };
  if (typeof Image !== 'undefined') {
    for (const src of sources) {
      const image = new Image();
      image.onload = settle;
      image.onerror = settle;
      image.src = src;
      images.push(image);
    }
  }
  return () => {
    finished = true;
    clearTimeout(timer);
    for (const image of images) {
      image.onload = null;
      image.onerror = null;
    }
  };
}

/** Drives `base -> ready -> all`: base sheets first, then the blink sheet. Resumes from the current stage. */
function startPreload() {
  if (cancelPreload || !urls || (stage !== 'base' && stage !== 'ready')) return;
  const { directions, reactions, blinks } = urls;
  if (stage === 'ready') {
    cancelPreload = preload([blinks], () => {
      cancelPreload = null;
      setStage('all');
    });
    return;
  }
  cancelPreload = preload([directions, reactions], () => {
    cancelPreload = null;
    setStage('ready');
    if (attached > 0) startPreload();
  });
}

/**
 * Lets the base sheets load now (interaction or idle). Safe to call repeatedly; a no-op after the first
 * call. Preloading only runs while at least one mascot is mounted.
 */
export function requestMascotSprites() {
  if (stage !== 'none') return;
  disarmTriggers?.();
  setStage('base');
  if (attached > 0) startPreload();
}

/**
 * Registers a mounted mascot with the loader. The first one arms the idle and global interaction
 * triggers; the last one to leave disarms them, so nothing keeps running with no mascot on the page.
 */
export function attachMascotSprites(next: MascotSpriteUrls): () => void {
  urls = next;
  attached += 1;
  if (attached === 1) {
    if (stage === 'none') armTriggers();
    else startPreload();
  }
  return () => {
    attached = Math.max(0, attached - 1);
    if (attached === 0) {
      disarmTriggers?.();
      stopPreload();
    }
  };
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const getStage = () => stage;
const getServerStage = (): MascotSpriteStage => 'none';

/** The current sprite stage; `none` on the server and during hydration. */
export function useMascotSpriteStage(): MascotSpriteStage {
  return useSyncExternalStore(subscribe, getStage, getServerStage);
}

/** Returns the loader to its initial state. For tests only; not part of the package's public API. */
export function resetMascotSpritesForTests() {
  disarmTriggers?.();
  stopPreload();
  stage = 'none';
  urls = null;
  attached = 0;
  listeners.clear();
}
