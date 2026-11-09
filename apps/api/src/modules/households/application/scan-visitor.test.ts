import { describe, expect, it } from 'vitest';
import { internalKeyMatches, visitorHash, visitorIdentity } from './scan-visitor';

describe('scan visitor identity', () => {
  const headers = {
    'x-internal-key': 'secret',
    'x-visitor-ip': '203.0.113.9',
    'x-visitor-ua': 'Visitor/1',
    'user-agent': 'node',
  };

  it('trusts X-Visitor-* only with the matching secret', () => {
    expect(visitorIdentity({ ip: '10.0.0.1', headers }, 'secret')).toBe('203.0.113.9|Visitor/1');
    // Forwarded visitor without a valid key: no identity, so the scan is counted without dedupe.
    expect(visitorIdentity({ ip: '10.0.0.1', headers }, 'other')).toBeUndefined();
    const direct = { 'user-agent': 'Phone/1' };
    expect(visitorIdentity({ ip: '10.0.0.1', headers: direct }, 'secret')).toBe('10.0.0.1|Phone/1');
  });

  it('never trusts the headers when the secret is unset', () => {
    const empty = { ...headers, 'x-internal-key': '' };
    expect(visitorIdentity({ ip: '10.0.0.1', headers: empty }, undefined)).toBeUndefined();
    expect(internalKeyMatches(undefined, '')).toBe(false);
    expect(internalKeyMatches('', '')).toBe(false);
  });

  it('hashes per code and Vietnam day', () => {
    const noon = new Date('2026-11-09T05:00:00Z');
    expect(visitorHash('A', 'x', noon)).toBe(
      visitorHash('A', 'x', new Date('2026-11-09T16:00:00Z')),
    );
    expect(visitorHash('A', 'x', noon)).not.toBe(
      visitorHash('A', 'x', new Date('2026-11-09T17:30:00Z')),
    );
    expect(visitorHash('A', 'x', noon)).not.toBe(visitorHash('B', 'x', noon));
    expect(visitorHash('A', 'x', noon)).toMatch(/^[0-9a-f]{64}$/);
  });
});
