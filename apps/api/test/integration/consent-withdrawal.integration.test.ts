import { AuditLog, ConsentRecord } from '@vcraft/database';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startTestApp, type TestApp } from './support/test-app.js';
import { startTestDatabase, type TestDatabase } from './support/test-database.js';

const POLICY = '2026-11-01';
const ID = '079203004567';

/**
 * GH#418 (Decree 13/2023/ND-CP Art. 12): a person can withdraw a consent. The record stays as history,
 * `ConsentService.require` refuses it afterwards, and the citizen ID number needs the ID_DOCUMENT consent.
 */
describe('Consent withdrawal and the ID number consent', () => {
  let db: TestDatabase;
  let t: TestApp;

  beforeAll(async () => {
    db = await startTestDatabase();
    await db.migrate();
    t = await startTestApp(db);
  }, 240_000);

  afterAll(async () => {
    await t?.close();
    await db?.stop();
  });

  const withdraw = (auth: string, purpose: string) =>
    t.request({ method: 'DELETE', url: `/me/consents/${purpose}`, auth });
  const consent = (auth: string, purpose: string) =>
    t.request({
      method: 'POST',
      url: '/me/consents',
      auth,
      body: { purpose, policyVersion: POLICY },
    });

  it('records the withdrawal, keeps the history and audits it', async () => {
    const user = await t.createUser('BUYER');
    const res = await withdraw(user.auth, 'RFQ_CONTACT');
    expect(res.status).toBe(200);
    const row = res.body.data.find((c: { purpose: string }) => c.purpose === 'RFQ_CONTACT');
    expect(row.withdrawnAt).toEqual(expect.any(String));
    const others = res.body.data.filter((c: { purpose: string }) => c.purpose !== 'RFQ_CONTACT');
    expect(others.every((c: { withdrawnAt: string | null }) => c.withdrawnAt === null)).toBe(true);
    expect(await db.orm.em.fork().count(ConsentRecord, { userId: user.id })).toBe(4);
    const audit = await db.orm.em
      .fork()
      .find(AuditLog, { actorId: user.id, action: 'consent.withdraw' });
    expect(audit).toHaveLength(1);
    expect(audit[0]?.after).toEqual({ purpose: 'RFQ_CONTACT' });

    // Withdrawing again changes nothing and writes no second audit entry.
    expect((await withdraw(user.auth, 'RFQ_CONTACT')).status).toBe(200);
    expect(
      await db.orm.em.fork().count(AuditLog, { actorId: user.id, action: 'consent.withdraw' }),
    ).toBe(1);
  });

  it('refuses what needs a withdrawn consent, until the person consents again', async () => {
    const user = await t.createUser('BUYER');
    const rfq = (auth: string) =>
      t.request({
        method: 'POST',
        url: '/rfqs',
        auth,
        body: {
          title: 'Logo cups',
          design: '100 cups with a printed logo',
          quantity: 100,
          unit: 'cup',
          destination: '12 Secret Street, Hanoi',
          requiredBy: new Date(Date.now() + 20 * 86_400_000).toISOString(),
          biddingClosesAt: new Date(Date.now() + 5 * 86_400_000).toISOString(),
          coordinationOptIn: true,
        },
      });
    await withdraw(user.auth, 'RFQ_CONTACT');
    const refused = await rfq(user.auth);
    expect(refused.status).toBe(403);
    expect(refused.body.code).toBe('CONSENT_REQUIRED');

    const again = await consent(user.auth, 'RFQ_CONTACT');
    expect(again.status).toBe(201);
    expect(again.body.withdrawnAt).toBeNull();
    expect((await rfq(user.auth)).status).toBe(201);
    expect(await db.orm.em.fork().count(ConsentRecord, { userId: user.id })).toBe(5);
  });

  it('refuses to withdraw SIGN_UP and points to account deletion', async () => {
    const user = await t.createUser('BUYER');
    const res = await withdraw(user.auth, 'SIGN_UP');
    expect(res.status).toBe(422);
    expect(res.body.errors[0].code).toBe('consent_not_withdrawable');
    expect(
      await db.orm.em.fork().count(ConsentRecord, { userId: user.id, withdrawnAt: null }),
    ).toBe(4);
  });

  it('rejects an unknown purpose and requires sign-in', async () => {
    const user = await t.createUser('BUYER');
    expect((await withdraw(user.auth, 'NOPE')).status).toBe(422);
    expect((await t.request({ method: 'DELETE', url: '/me/consents/ID_DOCUMENT' })).status).toBe(
      401,
    );
  });

  describe('citizen ID number', () => {
    const apply = (auth: string, slug: string, idNumber?: string) =>
      t.request({
        method: 'POST',
        url: '/me/household',
        auth,
        body: { name: 'Hộ CCCD', slug, history: '', ...(idNumber && { idNumber }) },
      });

    it('fails without any ID_DOCUMENT consent on record, then succeeds once it is given (GH#455)', async () => {
      // No blanket consents: this is the state of a brand-new applicant.
      const user = await t.createUser('BUYER', { consent: false });
      expect((await consent(user.auth, 'SIGN_UP')).status).toBe(201);
      const refused = await apply(user.auth, 'ho-cccd-new-applicant', ID);
      expect(refused.status).toBe(403);
      expect(refused.body.code).toBe('CONSENT_REQUIRED');

      expect((await consent(user.auth, 'ID_DOCUMENT')).status).toBe(201);
      expect((await apply(user.auth, 'ho-cccd-new-applicant', ID)).status).toBe(201);
    });

    it('needs ID_DOCUMENT consent to apply with a number, and audits the entry', async () => {
      const user = await t.createUser('BUYER');
      await withdraw(user.auth, 'ID_DOCUMENT');
      const refused = await apply(user.auth, 'ho-cccd-refused', ID);
      expect(refused.status).toBe(403);
      expect(refused.body.code).toBe('CONSENT_REQUIRED');

      // Without a number the application does not need that consent.
      const user2 = await t.createUser('BUYER');
      await withdraw(user2.auth, 'ID_DOCUMENT');
      expect((await apply(user2.auth, 'ho-cccd-no-number')).status).toBe(201);

      const user3 = await t.createUser('BUYER');
      const ok = await apply(user3.auth, 'ho-cccd-ok', ID);
      expect(ok.status).toBe(201);
      const entries = await db.orm.em
        .fork()
        .find(AuditLog, { actorId: user3.id, action: 'household.set_id_number' });
      expect(entries).toHaveLength(1);
      expect(entries[0]?.entityId).toBe(ok.body.id);
      expect(JSON.stringify(entries[0])).not.toContain(ID);
    });

    it('needs ID_DOCUMENT consent to set or change it, and audits each change', async () => {
      const user = await t.createUser('BUYER');
      const applied = await apply(user.auth, 'ho-cccd-change');
      expect(applied.status).toBe(201);
      const put = (idNumber: string) =>
        t.request({
          method: 'PUT',
          url: '/me/household/id-number',
          auth: user.auth,
          body: { idNumber },
        });

      expect((await put(ID)).status).toBe(200);
      expect((await put('001099112233')).status).toBe(200);
      const count = () =>
        db.orm.em.fork().count(AuditLog, {
          actorId: user.id,
          action: 'household.set_id_number',
          entityId: applied.body.id,
        });
      expect(await count()).toBe(2);

      await withdraw(user.auth, 'ID_DOCUMENT');
      const refused = await put(ID);
      expect(refused.status).toBe(403);
      expect(refused.body.code).toBe('CONSENT_REQUIRED');
      expect(await count()).toBe(2);
      // The stored number stays: withdrawal does not delete existing data.
      const mine = await t.request({ method: 'GET', url: '/me/household', auth: user.auth });
      expect(mine.body.idNumberMasked).toBe('••••••••2233');
    });
  });
});
