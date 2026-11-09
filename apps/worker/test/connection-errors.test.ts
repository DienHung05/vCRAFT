import { describe, expect, it, vi } from 'vitest';
import { ERROR_LOG_INTERVAL_MS, logConnectionErrors } from '../src/connection-errors';

function source(name: string) {
  const listeners: Array<(error: Error) => void> = [];
  return {
    name,
    on: (_event: 'error', listener: (error: Error) => void) => void listeners.push(listener),
    emit: (message: string) => {
      for (const listener of listeners) listener(new Error(message));
    },
  };
}

describe('logConnectionErrors', () => {
  it('attaches an error listener to every source and logs the error', () => {
    const a = source('media');
    const b = source('mail');
    const logger = { error: vi.fn() };
    logConnectionErrors([a, b], logger);
    a.emit('ECONNRESET');
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('media'));
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('ECONNRESET'));
    b.emit('boom');
    expect(logger.error).toHaveBeenCalledTimes(2);
  });

  it('logs a burst once per interval and reports how many errors it swallowed', () => {
    const a = source('media');
    const logger = { error: vi.fn() };
    let at = 1_000_000;
    logConnectionErrors([a], logger, () => at);
    a.emit('e1');
    a.emit('e2');
    a.emit('e3');
    expect(logger.error).toHaveBeenCalledTimes(1);
    at += ERROR_LOG_INTERVAL_MS;
    a.emit('e4');
    expect(logger.error).toHaveBeenCalledTimes(2);
    expect(logger.error.mock.calls[1]?.[0]).toContain('+2 similar');
  });
});
