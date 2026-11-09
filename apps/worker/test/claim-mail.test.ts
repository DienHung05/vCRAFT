import { UniqueConstraintViolationException } from '@mikro-orm/core';
import { MailClaim, Notification, QuotationNotice } from '@vcraft/database';
import { describe, expect, it, vi } from 'vitest';
import { createMailClaim, MAIL_CLAIM_LEASE_MS } from '../src/processors/mail/claim-mail';
import { createNoticeClaim } from '../src/processors/mail/claim-notice';

const NOW = new Date('2026-11-10T12:00:00Z');
const STALE = new Date(NOW.getTime() - MAIL_CLAIM_LEASE_MS);

function fakeOrm(em: Record<string, unknown>) {
  return { em: { fork: () => em } } as never;
}

describe('createMailClaim', () => {
  it('claims a fresh key by inserting the row', async () => {
    const em = {
      nativeUpdate: vi.fn(async () => 0),
      create: vi.fn(),
      flush: vi.fn(async () => undefined),
    };
    expect(await createMailClaim(fakeOrm(em), () => NOW).claim('k')).toBe(true);
    expect(em.create).toHaveBeenCalledWith(MailClaim, { claimKey: 'k', claimedAt: NOW });
  });

  it('loses when the key is already claimed', async () => {
    const em = {
      nativeUpdate: vi.fn(async () => 0),
      create: vi.fn(),
      flush: vi.fn(async () => {
        throw new UniqueConstraintViolationException(new Error('duplicate'));
      }),
    };
    expect(await createMailClaim(fakeOrm(em), () => NOW).claim('k')).toBe(false);
  });

  it('rethrows errors that are not a duplicate key', async () => {
    const em = {
      nativeUpdate: vi.fn(async () => 0),
      create: vi.fn(),
      flush: vi.fn(async () => {
        throw new Error('db down');
      }),
    };
    await expect(createMailClaim(fakeOrm(em), () => NOW).claim('k')).rejects.toThrow('db down');
  });

  it('takes over an unsent claim older than the lease without inserting', async () => {
    const em = { nativeUpdate: vi.fn(async () => 1), create: vi.fn(), flush: vi.fn() };
    expect(await createMailClaim(fakeOrm(em), () => NOW).claim('k')).toBe(true);
    expect(em.nativeUpdate).toHaveBeenCalledWith(
      MailClaim,
      { claimKey: 'k', sentAt: null, claimedAt: { $lt: STALE } },
      { claimedAt: NOW },
    );
    expect(em.create).not.toHaveBeenCalled();
  });

  it('marks sent and releases only unsent claims', async () => {
    const em = { nativeUpdate: vi.fn(async () => 1), nativeDelete: vi.fn(async () => 1) };
    const claim = createMailClaim(fakeOrm(em), () => NOW);
    await claim.markSent('k');
    expect(em.nativeUpdate).toHaveBeenCalledWith(MailClaim, { claimKey: 'k' }, { sentAt: NOW });
    await claim.release('k');
    expect(em.nativeDelete).toHaveBeenCalledWith(MailClaim, { claimKey: 'k', sentAt: null });
  });
});

describe('createNoticeClaim', () => {
  it('claims an unclaimed notice or one whose unsent claim expired', async () => {
    const em = { nativeUpdate: vi.fn(async () => 1) };
    expect(await createNoticeClaim(fakeOrm(em), () => NOW).claim('n1')).toBe(true);
    expect(em.nativeUpdate).toHaveBeenCalledWith(
      QuotationNotice,
      {
        id: 'n1',
        $or: [{ emailedAt: null }, { emailSentAt: null, emailedAt: { $lt: STALE } }],
      },
      { emailedAt: NOW },
    );
  });

  it('falls through to the notification table and reports a lost claim', async () => {
    const em = { nativeUpdate: vi.fn(async () => 0) };
    expect(await createNoticeClaim(fakeOrm(em), () => NOW).claim('n1')).toBe(false);
    expect(em.nativeUpdate.mock.calls.map((call) => call[0])).toEqual([
      QuotationNotice,
      Notification,
    ]);
  });

  it('marks the notice sent on both tables', async () => {
    const em = { nativeUpdate: vi.fn(async () => 1) };
    await createNoticeClaim(fakeOrm(em), () => NOW).markSent('n1');
    expect(em.nativeUpdate).toHaveBeenCalledWith(
      QuotationNotice,
      { id: 'n1' },
      { emailSentAt: NOW },
    );
    expect(em.nativeUpdate).toHaveBeenCalledWith(Notification, { id: 'n1' }, { emailSentAt: NOW });
  });
});
