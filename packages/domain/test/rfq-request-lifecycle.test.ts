import { describe, expect, it } from 'vitest';
import { noticeRecipients, transition } from '../src';

const NOW = new Date('2026-01-10T00:00:00.000Z');
const HOUR = 60 * 60 * 1000;
const at = (offsetMs: number) => new Date(NOW.getTime() + offsetMs);

const codeOf = (r: { readonly ok: boolean; readonly error?: { readonly code: string } }): string =>
  r.ok ? 'OK' : (r.error?.code ?? 'NO_ERROR');

describe('buyer request lifecycle: deadline rule (SRS T1, GH#244: at least 24h away)', () => {
  const submit = (closesIn: number) =>
    transition('DRAFT', 'SUBMIT', {
      actor: 'BUYER_OWNER',
      now: NOW,
      emailVerified: true,
      biddingClosesAt: at(closesIn),
      requiredBy: at(30 * 24 * HOUR),
    });

  it('SUBMIT passes with the deadline exactly 24h away', () => {
    expect(submit(24 * HOUR).ok).toBe(true);
  });

  it('SUBMIT refuses a deadline less than 24h away', () => {
    expect(codeOf(submit(HOUR))).toBe('BIDDING_DEADLINE_TOO_SOON');
    expect(codeOf(submit(24 * HOUR - 1))).toBe('BIDDING_DEADLINE_TOO_SOON');
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

describe('buyer CANCEL only up to BIDDING (SRS T6, GH#244)', () => {
  it('buyer CANCEL from ACCEPTED is an invalid transition: only the admin cancels then (T7)', () => {
    const r = transition('ACCEPTED', 'CANCEL', { actor: 'BUYER_OWNER', reason: 'doi ke hoach' });
    expect(codeOf(r)).toBe('INVALID_TRANSITION');
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
    const r = transition('SENT', 'EXPIRE', {
      actor: 'SYSTEM',
      now: NOW,
      biddingClosesAt: at(HOUR),
    });
    expect(r.ok).toBe(false);
  });
});

describe('người nhận thông báo báo giá', () => {
  it('bỏ trống, bỏ trùng và bỏ chính người gây ra sự kiện', () => {
    expect(noticeRecipients(['buyer', null, 'admin', 'buyer', undefined, 'rep'], 'rep')).toEqual([
      'buyer',
      'admin',
    ]);
  });
});
