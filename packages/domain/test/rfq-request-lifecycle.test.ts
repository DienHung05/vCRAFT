import { describe, expect, it } from 'vitest';
import { transition, type RfqContext } from '../src';

const NOW = new Date('2026-01-10T00:00:00.000Z');
const HOUR = 60 * 60 * 1000;
const at = (offsetMs: number) => new Date(NOW.getTime() + offsetMs);

const codeOf = (r: { readonly ok: boolean; readonly error?: { readonly code: string } }): string =>
  r.ok ? 'OK' : (r.error?.code ?? 'NO_ERROR');

describe('GH#9 buyer request lifecycle: deadline rule (83g: any future time, no 24h minimum)', () => {
  it('SUBMIT passes with deadline 1h in the future', () => {
    const r = transition('DRAFT', 'SUBMIT', {
      actor: 'BUYER_OWNER',
      now: NOW,
      emailVerified: true,
      biddingClosesAt: at(HOUR),
      requiredBy: at(30 * 24 * HOUR),
    });
    expect(r.ok).toBe(true);
  });

  it('SUBMIT still refuses past deadline', () => {
    const r = transition('DRAFT', 'SUBMIT', {
      actor: 'BUYER_OWNER',
      now: NOW,
      emailVerified: true,
      biddingClosesAt: at(-1),
      requiredBy: at(30 * 24 * HOUR),
    });
    expect(codeOf(r)).toBe('BIDDING_DEADLINE_TOO_SOON');
  });
});

describe('GH#9: buyer CANCEL before production (ACCEPTED allowed, IN_PRODUCTION refused)', () => {
  it('buyer CANCEL from ACCEPTED with reason passes', () => {
    const r = transition('ACCEPTED', 'CANCEL', { actor: 'BUYER_OWNER', reason: 'doi ke hoach' });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe('CANCELLED');
  });

  it('buyer CANCEL from ACCEPTED without reason is refused', () => {
    const r = transition('ACCEPTED', 'CANCEL', { actor: 'BUYER_OWNER', reason: '' });
    expect(codeOf(r)).toBe('REASON_REQUIRED');
  });

  it('buyer CANCEL from IN_PRODUCTION is refused (only admin)', () => {
    const r = transition('IN_PRODUCTION', 'CANCEL', { actor: 'BUYER_OWNER', reason: 'muon huy' });
    expect(r.ok).toBe(false);
  });
});

describe('GH#9: admin cancel after production start', () => {
  it('ADMIN_CANCEL from IN_PRODUCTION with reason passes', () => {
    const r = transition('IN_PRODUCTION', 'ADMIN_CANCEL', {
      actor: 'ADMIN',
      reason: 'don khong kha thi',
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe('CANCELLED');
  });

  it('non-admin ADMIN_CANCEL from IN_PRODUCTION is refused', () => {
    const r = transition('IN_PRODUCTION', 'ADMIN_CANCEL', {
      actor: 'BUYER_OWNER',
      reason: 'muon huy',
    });
    expect(codeOf(r)).toBe('ACTOR_NOT_ALLOWED');
  });
});

describe('GH#9: unaccepted request expires at deadline', () => {
  it('EXPIRE from SENT once now >= biddingClosesAt', () => {
    const closes = NOW;
    const r = transition('SENT', 'EXPIRE', { actor: 'SYSTEM', now: NOW, biddingClosesAt: closes });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe('EXPIRED');
  });

  it('EXPIRE refused before deadline', () => {
    const r = transition('SENT', 'EXPIRE', { actor: 'SYSTEM', now: NOW, biddingClosesAt: at(HOUR) });
    expect(r.ok).toBe(false);
  });
});
