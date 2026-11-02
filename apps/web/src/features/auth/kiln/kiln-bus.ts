/**
 * A tiny event bus between the card (which fires embers when a form is submitted) and the WebGL ember
 * island (which draws them). No dependencies. When the island is not mounted (reduced motion, no WebGL,
 * not loaded yet) nobody listens, so `fire` is a no-op and the CSS firing glow alone carries the moment.
 */

/** The part of a DOMRect the island needs; a DOMRect satisfies it. */
export interface KilnRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface KilnBurst {
  /** Where the embers leave (the submit button), in viewport coordinates. */
  from: KilnRect;
  /** Where they arrive and fade (the visible trace seal), in viewport coordinates. */
  to: KilnRect;
  /** A shorter, smaller burst (about 400ms) that lands with the seal stamp. */
  quick?: boolean;
}

type BurstListener = (burst: KilnBurst) => void;

const listeners = new Set<BurstListener>();

/** Subscribes the island to bursts; returns the unsubscribe function. */
export function onKilnBurst(listener: BurstListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Streams a burst of embers from `from` to `to` (about 520ms, ease.kiln; `quick` is shorter), if the island is mounted. */
export function fire(burst: KilnBurst): void {
  for (const listener of listeners) listener(burst);
}
