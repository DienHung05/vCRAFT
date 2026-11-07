import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuthRateLimit } from './auth-rate-limit';

afterEach(() => vi.unstubAllEnvs());

describe('Password authentication limits', () => {
  it('limits one IP even when the submitted username changes', async () => {
    vi.stubEnv('REDIS_URL', '');
    const limits = new AuthRateLimit();
    for (let attempt = 0; attempt < 15; attempt++)
      await limits.check('192.0.2.1', 'sign-in', `user${attempt}`);
    await expect(limits.check('192.0.2.1', 'sign-in', 'another')).rejects.toMatchObject({
      code: 'RATE_LIMITED',
    });
    await expect(limits.check('192.0.2.2', 'sign-in', 'different')).resolves.toBeUndefined();
  });

  it('requires the shared Redis store in production', async () => {
    vi.stubEnv('REDIS_URL', '');
    vi.stubEnv('NODE_ENV', 'production');
    const limits = new AuthRateLimit();
    await expect(limits.check('192.0.2.1', 'sign-in')).rejects.toMatchObject({
      code: 'SERVICE_UNAVAILABLE',
    });
  });
});
