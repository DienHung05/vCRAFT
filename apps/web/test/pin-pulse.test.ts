import { describe, expect, it } from 'vitest';
import { PULSE_STEP_MS, pulseDue, pulsePaint, shouldPulse } from '@/features/village-map/pin-pulse';

describe('open workshop pin pulse (GH#144)', () => {
  it('keeps the 2 s breathing look', () => {
    expect(pulsePaint(0)).toEqual({ radius: 8, opacity: 0.45 });
    expect(pulsePaint(1000)).toEqual({ radius: 15, opacity: 0.225 });
    expect(pulsePaint(2000)).toEqual(pulsePaint(0));
  });

  it('draws at most one update per step', () => {
    expect(pulseDue(0, null)).toBe(true);
    expect(pulseDue(16, 0)).toBe(false);
    expect(pulseDue(PULSE_STEP_MS - 1, 0)).toBe(false);
    expect(pulseDue(PULSE_STEP_MS, 0)).toBe(true);
  });

  it('only runs when visible, wanted and there is an open pin', () => {
    const on = { reducedMotion: false, inView: true, hasOpenPin: true };
    expect(shouldPulse(on)).toBe(true);
    expect(shouldPulse({ ...on, reducedMotion: true })).toBe(false);
    expect(shouldPulse({ ...on, inView: false })).toBe(false);
    expect(shouldPulse({ ...on, hasOpenPin: false })).toBe(false);
  });
});
