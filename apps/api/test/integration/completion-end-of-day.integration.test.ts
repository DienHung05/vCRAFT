import {
  AppUser,
  ContributionOffer,
  CooperativeQuotation,
  Household,
  QuotationRequest,
} from '@vcraft/database';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startTestApp, type TestApp } from './support/test-app.js';
import { startTestDatabase, type TestDatabase, testDriver } from './support/test-database.js';

/**
 * GH#443: completion dates stored as midnight UTC (07:00 in Vietnam) move to the end of that day in Vietnam,
 * on both drivers; dates already at another time are left alone.
 */
describe('Migration: household completion dates at end of day in Vietnam', () => {
  let db: TestDatabase;
  let t: TestApp;
  const DAY = 86_400_000;
  const migration =
    testDriver === 'mysql'
      ? 'Migration20261110130001_completion_end_of_day'
      : 'Migration20261110130000_completion_end_of_day';

  beforeAll(async () => {
    db = await startTestDatabase();
    await db.migrate();
    t = await startTestApp(db);
  });

  afterAll(async () => {
    await t?.close();
    await db?.stop();
  });

  it('moves midnight-UTC offers, offer history and quotation parts to 23:59:59 in Vietnam', async () => {
    const admin = await t.createUser('ADMIN');
    const buyer = await t.createUser('BUYER');
    const rep = await t.createUser('BUYER');
    const applied = await t.request({
      method: 'POST',
      url: '/me/household',
      auth: rep.auth,
      body: { name: 'Hộ hẹn ngày', slug: 'ho-hen-ngay', history: '' },
    });
    await t.request({
      method: 'POST',
      url: `/admin/households/${applied.body.id}/approve`,
      auth: admin.auth,
      headers: { 'if-match': String(applied.body.version) },
    });

    const em = db.orm.em.fork();
    const household = await em.findOneOrFail(Household, { slug: 'ho-hen-ngay' });
    const now = Date.now();
    const request = em.create(QuotationRequest, {
      buyer: em.getReference(AppUser, buyer.id),
      design: 'Bát men rạn',
      quantity: 100,
      unit: 'bát',
      destination: 'Hà Nội',
      requiredBy: new Date(now + 40 * DAY),
      biddingClosesAt: new Date(now + 5 * DAY),
      invitedHouseholdIds: [household.id],
      status: 'BIDDING',
    });
    const offer = em.create(ContributionOffer, {
      request,
      household,
      maxQuantity: 100,
      unitPriceVnd: 30_000,
      completionDate: new Date('2099-11-20T00:00:00.000Z'),
      history: [
        {
          version: 1,
          maxQuantity: 100,
          unitPriceVnd: 30_000,
          completionDate: '2099-11-19T00:00:00.000Z',
          status: 'ACTIVE',
        },
      ],
    });
    const kept = em.create(ContributionOffer, {
      request: em.create(QuotationRequest, {
        buyer: em.getReference(AppUser, buyer.id),
        design: 'Bình hoa',
        quantity: 10,
        unit: 'bình',
        destination: 'Huế',
        requiredBy: new Date(now + 40 * DAY),
        biddingClosesAt: new Date(now + 5 * DAY),
        invitedHouseholdIds: [household.id],
        status: 'BIDDING',
      }),
      household,
      maxQuantity: 10,
      unitPriceVnd: 50_000,
      completionDate: new Date('2099-11-20T16:59:59.000Z'),
    });
    const quotation = em.create(CooperativeQuotation, {
      request,
      quantity: 100,
      parts: [
        {
          householdId: household.id,
          quantity: 60,
          unitPriceVnd: 30_000,
          completionDate: '2099-11-20T00:00:00.000Z',
          contributionVersion: 1,
        },
        {
          householdId: household.id,
          quantity: 40,
          unitPriceVnd: 30_000,
          completionDate: '2099-11-21T05:00:00.000Z',
          contributionVersion: 1,
        },
      ],
      productionTotalVnd: 3_000_000,
      totalVnd: 3_000_000,
      deliveryTerms: 'INCLUDED',
    });
    await em.flush();

    // Run the data migration again over the rows above.
    await db.orm.migrator.down(migration);
    await db.orm.migrator.up(migration);

    const check = db.orm.em.fork();
    const moved = await check.findOneOrFail(ContributionOffer, offer.id);
    expect(moved.completionDate.toISOString()).toBe('2099-11-20T16:59:59.000Z');
    expect(moved.history[0]?.completionDate).toBe('2099-11-19T16:59:59.000Z');
    expect(
      (await check.findOneOrFail(ContributionOffer, kept.id)).completionDate.toISOString(),
    ).toBe('2099-11-20T16:59:59.000Z');
    const parts = (await check.findOneOrFail(CooperativeQuotation, quotation.id)).parts;
    expect(parts.map((part) => part.completionDate)).toEqual([
      '2099-11-20T16:59:59.000Z',
      '2099-11-21T05:00:00.000Z',
    ]);
    expect(parts[0]?.quantity).toBe(60);
  });
});
