/** One breathing cycle of an open workshop's pin (FR-MAP-03). */
export const PULSE_PERIOD_MS = 2000;

/**
 * Least time between two pulse updates. Each update makes MapLibre redraw the whole map, so the pulse
 * runs at about 20 fps instead of the display rate (GH#144); a 2 s fade still reads as smooth.
 */
export const PULSE_STEP_MS = 50;

export interface PulsePaint {
  radius: number;
  opacity: number;
}

/** Radius grows from 8 to 22 px while the ring fades out, then the cycle restarts. */
export function pulsePaint(time: number): PulsePaint {
  const phase = (time % PULSE_PERIOD_MS) / PULSE_PERIOD_MS;
  return { radius: 8 + phase * 14, opacity: 0.45 * (1 - phase) };
}

/** Whether a frame at `time` is due, given the time of the last update that was drawn. */
export function pulseDue(time: number, lastDrawn: number | null): boolean {
  return lastDrawn === null || time - lastDrawn >= PULSE_STEP_MS;
}

export interface PulseConditions {
  reducedMotion: boolean;
  /** The map frame intersects the viewport. */
  inView: boolean;
  /** At least one workshop on the map is open now. */
  hasOpenPin: boolean;
}

/** The pulse only costs anything while someone can see it and there is something to pulse. */
export function shouldPulse({ reducedMotion, inView, hasOpenPin }: PulseConditions): boolean {
  return !reducedMotion && inView && hasOpenPin;
}
