import { FastifyAdapter } from '@nestjs/platform-fastify';
import { describe, expect, it } from 'vitest';
import { parseTrustProxy, type TrustProxyFn, type TrustProxyValue } from './trust-proxy';

describe('parseTrustProxy', () => {
  it('trusts nobody when unset, empty or false', () => {
    for (const raw of [undefined, '', '  ', 'false', 'FALSE', '0'])
      expect(parseTrustProxy(raw)).toEqual({ value: false });
  });

  it('reads a positive integer as a hop count', () => {
    const one = parseTrustProxy('1').value as TrustProxyFn;
    expect([one('a', 0), one('a', 1)]).toEqual([true, false]);
    const two = parseTrustProxy(' 2 ').value as TrustProxyFn;
    expect([two('a', 0), two('a', 1), two('a', 2)]).toEqual([true, true, false]);
  });

  it('reads a comma-separated list of IPs and CIDRs', () => {
    expect(parseTrustProxy('10.0.0.1, 173.245.48.0/20,2400:cb00::/32')).toEqual({
      value: ['10.0.0.1', '173.245.48.0/20', '2400:cb00::/32'],
    });
  });

  it('maps legacy true to 1 hop with a warning, never trust-all', () => {
    const result = parseTrustProxy('true');
    expect(typeof result.value).toBe('function');
    expect(result.warning).toMatch(/deprecated/);
  });

  it('falls back to no trust with a warning for garbage', () => {
    for (const raw of ['yes', '999.1.1.1', '10.0.0.1/40', '1,abc', '-1']) {
      const result = parseTrustProxy(raw);
      expect(result.value).toBe(false);
      expect(result.warning).toBeDefined();
    }
  });
});

describe('trustProxy with Fastify', () => {
  async function clientIp(trustProxy: TrustProxyValue, xff: string) {
    // Same adapter main.ts builds, so the option is applied the way the API applies it.
    const app = new FastifyAdapter({ trustProxy }).getInstance();
    app.get('/ip', async (req) => req.ip);
    const res = await app.inject({
      method: 'GET',
      url: '/ip',
      remoteAddress: '10.0.0.9',
      headers: { 'x-forwarded-for': xff },
    });
    await app.close();
    return res.body;
  }

  it('keeps the proxy-appended IP behind 1 trusted hop when the client spoofs the header', async () => {
    // The client sent "1.2.3.4"; the proxy appended the address it actually saw.
    const { value } = parseTrustProxy('1');
    expect(await clientIp(value, '1.2.3.4, 203.0.113.7')).toBe('203.0.113.7');
  });

  it('keeps the proxy-appended IP for legacy true', async () => {
    const { value } = parseTrustProxy('true');
    expect(await clientIp(value, '1.2.3.4, 203.0.113.7')).toBe('203.0.113.7');
  });

  it('ignores the header entirely when nothing is trusted', async () => {
    const { value } = parseTrustProxy(undefined);
    expect(await clientIp(value, '1.2.3.4, 203.0.113.7')).toBe('10.0.0.9');
  });
});
