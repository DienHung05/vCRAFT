import { describe, expect, it, vi } from 'vitest';
import { LiveSignal } from './live-signal';

describe('LiveSignal (GH#537)', () => {
  it('wakes only the subscribers of the notified recipients, once per notify', () => {
    const signal = new LiveSignal();
    const a = vi.fn();
    const b = vi.fn();
    signal.subscribe('a', a);
    signal.subscribe('b', b);
    signal.notify(['a', 'a']);
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).not.toHaveBeenCalled();
  });

  it('stops waking a listener once it unsubscribed', () => {
    const signal = new LiveSignal();
    const listener = vi.fn();
    const unsubscribe = signal.subscribe('a', listener);
    unsubscribe();
    signal.notify(['a']);
    expect(listener).not.toHaveBeenCalled();
  });

  it('serves many open streams of one account without a listener warning', () => {
    const signal = new LiveSignal();
    const warn = vi.spyOn(process, 'emitWarning').mockImplementation(() => undefined);
    const listeners = Array.from({ length: 25 }, () => vi.fn());
    for (const listener of listeners) signal.subscribe('a', listener);
    signal.notify(['a']);
    expect(listeners.every((l) => l.mock.calls.length === 1)).toBe(true);
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});
