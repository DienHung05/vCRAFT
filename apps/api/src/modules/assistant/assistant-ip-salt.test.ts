import { describe, expect, it, vi } from 'vitest';
import { resolveIpSalt } from './assistant-ip-salt';

describe('resolveIpSalt (GH#410)', () => {
  it('uses the configured salt, trimmed, in every environment', () => {
    const warn = vi.fn();
    expect(resolveIpSalt({ NODE_ENV: 'production', ASSISTANT_IP_SALT: '  s3cret ' }, warn)).toBe(
      's3cret',
    );
    expect(resolveIpSalt({ NODE_ENV: 'test', ASSISTANT_IP_SALT: 'abc' }, warn)).toBe('abc');
    expect(warn).not.toHaveBeenCalled();
  });

  it('derives a stable salt from the server secret in production without one, and warns', () => {
    const warn = vi.fn();
    const env = { NODE_ENV: 'production', SUPABASE_SECRET_KEY: 'sb_secret_x' };
    const first = resolveIpSalt(env, warn);
    expect(resolveIpSalt({ ...env, ASSISTANT_IP_SALT: '  ' }, warn)).toBe(first);
    expect(first).not.toContain('sb_secret_x');
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('ASSISTANT_IP_SALT'));
    // No server secret either: still starts, with a random salt and a warning.
    expect(resolveIpSalt({ NODE_ENV: 'production' }, warn)).toMatch(/^[0-9a-f]{64}$/);
  });

  it('falls back to a random salt with a warning in dev and test', () => {
    const warn = vi.fn();
    const a = resolveIpSalt({ NODE_ENV: 'development' }, warn);
    const b = resolveIpSalt({}, warn);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(a).not.toBe(b);
    expect(warn).toHaveBeenCalledTimes(2);
  });
});
