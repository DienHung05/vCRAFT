import {
  AppUser,
  CooperativeQuotation,
  Household,
  MediaAsset,
  MediaLink,
  OrderAllocation,
  QuotationRequest,
} from '@vcraft/database';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startTestApp, type TestApp } from './support/test-app.js';
import { startTestDatabase, type TestDatabase } from './support/test-database.js';

/**
 * Issue #91 (PLAN E10, FR-ORD-09): the admin allocation timeline and reallocating the unfinished part of
 * a late share. The order is set up directly in production; the endpoints are exercised over HTTP.
 */
describe('Allocation timeline and reallocation', () => {
  let db: TestDatabase;
  let t: TestApp;
  let admin: { auth: string };
  let buyer: { id: string; auth: string };
  let requestId: string;
  const representatives: { id: string; auth: string }[] = [];
  let households: Household[];
  let late: OrderAllocation;
  let quotationId: string;
  let attachmentId: string;
  const DAY = 86_400_000;

  beforeAll(async () => {
    db = await startTestDatabase();
    await db.migrate();
    t = await startTestApp(db);
    admin = await t.createUser('ADMIN');
    buyer = await t.createUser('BUYER');
    households = [];
    for (const name of ['a', 'b', 'c']) {
      const rep = await t.createUser('BUYER');
      representatives.push(rep);
      const applied = await t.request({
        method: 'POST',
        url: '/me/household',
        auth: rep.auth,
        body: { name: `Gantt ${name}`, slug: `gantt-${name}`, history: '' },
      });
      await t.request({
        method: 'POST',
        url: `/admin/households/${applied.body.id}/approve`,
        auth: admin.auth,
        headers: { 'if-match': String(applied.body.version) },
      });
    }
    const em = db.orm.em.fork();
    households = await em.find(
      Household,
      { slug: { $like: 'gantt-%' } },
      { orderBy: { slug: 'asc' } },
    );
    const [a, b] = households as [Household, Household, Household];
    const now = Date.now();
    const request = em.create(QuotationRequest, {
      buyer: em.getReference(AppUser, buyer.id),
      design: 'Cốc men lam',
      quantity: 1000,
      unit: 'cốc',
      destination: 'Hà Nội',
      requiredBy: new Date(now + 20 * DAY),
      biddingClosesAt: new Date(now - 10 * DAY),
      invitedHouseholdIds: [a.id, b.id],
      status: 'IN_PRODUCTION',
    });
    const quotation = em.create(CooperativeQuotation, {
      request,
      status: 'ACCEPTED',
      quantity: 1000,
      parts: [
        // Household a promised day -1: it is overdue with pieces left.
        {
          householdId: a.id,
          quantity: 600,
          unitPriceVnd: 40_000,
          completionDate: new Date(now - DAY).toISOString(),
          contributionVersion: 1,
        },
        {
          householdId: b.id,
          quantity: 400,
          unitPriceVnd: 42_000,
          completionDate: new Date(now + 10 * DAY).toISOString(),
          contributionVersion: 1,
        },
      ],
      productionTotalVnd: 40_800_000,
      totalVnd: 40_800_000,
      deliveryTerms: 'INCLUDED',
    });
    requestId = request.id;
    quotationId = quotation.id;
    late = em.create(OrderAllocation, {
      quotation,
      household: a,
      quantity: 600,
      completedQty: 200,
      status: 'IN_PROGRESS',
    });
    em.create(OrderAllocation, {
      quotation,
      household: b,
      quantity: 400,
      completedQty: 100,
      status: 'IN_PROGRESS',
    });
    const attachment = em.create(MediaAsset, {
      ownerId: buyer.id,
      purpose: 'RFQ_ATTACHMENT',
      visibility: 'PRIVATE',
      status: 'READY',
      mimeType: 'image/png',
      sizeBytes: 70,
      sha256: 'a'.repeat(64),
      originalKey: `originals/${buyer.id}/allocation-schedule-attachment`,
    });
    attachmentId = attachment.id;
    em.create(MediaLink, {
      media: attachment,
      targetType: 'RFQ',
      targetId: request.id,
      role: 'DOCUMENT',
      position: 0,
    });
    await em.flush();
  }, 240_000);

  afterAll(async () => {
    await t?.close();
    await db?.stop();
  });

  it('lists running orders with each share, its due date and lateness', async () => {
    const res = await t.request({ method: 'GET', url: '/admin/allocations', auth: admin.auth });
    expect(res.status).toBe(200);
    const order = res.body[0];
    expect(order.allocations).toHaveLength(2);
    const a = order.allocations.find((x: { id: string }) => x.id === late.id);
    expect(a).toMatchObject({ quantity: 600, completedQty: 200, lateness: 'OVERDUE' });
  });

  it('gives the buyer the same timeline and risk as the board without quotation prices', async () => {
    const res = await t.request({
      method: 'GET',
      url: `/rfqs/${requestId}/allocations`,
      auth: buyer.auth,
    });
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body.find((share: { id: string }) => share.id === late.id)).toMatchObject({
      householdName: 'Gantt a',
      quantity: 600,
      completedQty: 200,
      lateness: 'OVERDUE',
      expectedQty: 600,
      progressPercent: 33,
    });
    expect(res.body[0].startedAt).toEqual(expect.any(String));
    expect(res.body[0].dueAt).toEqual(expect.any(String));
    expect(res.body[0]).not.toHaveProperty('unitPriceVnd');
  });

  it('keeps household timelines private and rejects foreign buyers', async () => {
    const own = await t.request({
      method: 'GET',
      url: `/rfqs/${requestId}/allocations`,
      auth: representatives[0]?.auth,
    });
    expect(own.status).toBe(200);
    expect(own.body).toHaveLength(1);
    expect(own.body[0]).toMatchObject({ householdName: 'Gantt a', lateness: 'OVERDUE' });
    const studio = await t.request({
      method: 'GET',
      url: '/me/allocations',
      auth: representatives[0]?.auth,
    });
    expect(studio.status).toBe(200);
    expect(studio.body).toHaveLength(1);
    expect(studio.body[0]).toMatchObject({
      householdName: 'Gantt a',
      lateness: 'OVERDUE',
      progressPercent: 33,
    });
    const foreign = await t.createUser('BUYER');
    expect(
      (
        await t.request({
          method: 'GET',
          url: `/rfqs/${requestId}/allocations`,
          auth: foreign.auth,
        })
      ).status,
    ).toBe(404);
    expect(
      (
        await t.request({
          method: 'GET',
          url: `/rfqs/${requestId}/allocations`,
          auth: representatives[2]?.auth,
        })
      ).status,
    ).toBe(404);
  });

  it('refuses targets that do not cover the remaining quantity', async () => {
    const res = await t.request({
      method: 'POST',
      url: `/admin/allocations/${late.id}/reallocate`,
      auth: admin.auth,
      headers: { 'if-match': `"${late.version}"` },
      body: { targets: [{ householdId: households[2]?.id, quantity: 100 }] },
    });
    expect(res.status).toBe(422);
  });

  it('refuses a target whose representative is locked', async () => {
    const [, , c] = households as [Household, Household, Household];
    const repC = representatives[2] as { id: string; auth: string };
    const em = db.orm.em.fork();
    await em.nativeUpdate(AppUser, repC.id, { status: 'LOCKED' });
    try {
      const res = await t.request({
        method: 'POST',
        url: `/admin/allocations/${late.id}/reallocate`,
        auth: admin.auth,
        headers: { 'if-match': `"${late.version}"` },
        body: {
          targets: [
            { householdId: households[1]?.id, quantity: 150 },
            { householdId: c.id, quantity: 250 },
          ],
        },
      });
      expect(res.status).toBe(403);
      expect(res.body.code).toBe('RFQ_ARTISAN_NOT_ELIGIBLE');
    } finally {
      await em.nativeUpdate(AppUser, repC.id, { status: 'ACTIVE' });
    }
  });

  it('is reserved for the coordinator of a coordinated request', async () => {
    const [, b, c] = households as [Household, Household, Household];
    const other = await t.createUser('ADMIN');
    const em = db.orm.em.fork();
    await em.nativeUpdate(QuotationRequest, requestId, {
      coordinationOptIn: true,
      coordinatorId: other.id,
    });
    try {
      const res = await t.request({
        method: 'POST',
        url: `/admin/allocations/${late.id}/reallocate`,
        auth: admin.auth,
        headers: { 'if-match': `"${late.version}"` },
        body: {
          targets: [
            { householdId: b.id, quantity: 150 },
            { householdId: c.id, quantity: 250 },
          ],
        },
      });
      expect(res.status).toBe(404);
    } finally {
      await em.nativeUpdate(QuotationRequest, requestId, {
        coordinationOptIn: false,
        coordinatorId: null,
      });
    }
  });

  it('moves the unfinished pieces and keeps the order total', async () => {
    const [, b, c] = households as [Household, Household, Household];
    const res = await t.request({
      method: 'POST',
      url: `/admin/allocations/${late.id}/reallocate`,
      auth: admin.auth,
      headers: { 'if-match': `"${late.version}"` },
      body: {
        targets: [
          { householdId: b.id, quantity: 150 },
          { householdId: c.id, quantity: 250 },
        ],
      },
    });
    expect(res.status).toBe(200);

    const rows = await db.orm.em
      .fork()
      .find(OrderAllocation, { quotation: quotationId }, { populate: ['household'] });
    const of = (h: Household) => rows.find((r) => r.household.id === h.id);
    expect(of(households[0] as Household)).toMatchObject({ quantity: 200, status: 'DONE' });
    expect(of(b)?.quantity).toBe(550);
    expect(of(c)).toMatchObject({ quantity: 250, status: 'IN_PROGRESS' });
    const active = rows.filter((r) => r.status !== 'CANCELLED');
    expect(active.reduce((sum, r) => sum + r.quantity, 0)).toBe(1000);

    const quotation = await db.orm.em.fork().findOneOrFail(CooperativeQuotation, quotationId);
    expect(quotation.parts.map((p) => p.householdId)).toContain(c.id);
    const request = await db.orm.em.fork().findOneOrFail(QuotationRequest, requestId);
    expect(request.invitedHouseholdIds).toEqual(expect.arrayContaining([c.id]));

    // The new household can read the order it must now make: request, allocations and attachments.
    const repC = representatives[2];
    const detail = await t.request({ method: 'GET', url: `/rfqs/${requestId}`, auth: repC?.auth });
    expect(detail.status).toBe(200);
    expect(detail.body.attachments.map((file: { id: string }) => file.id)).toEqual([attachmentId]);
    const shares = await t.request({
      method: 'GET',
      url: `/rfqs/${requestId}/allocations`,
      auth: repC?.auth,
    });
    expect(shares.status).toBe(200);
    expect(shares.body).toHaveLength(1);
    expect(shares.body[0]).toMatchObject({ householdName: 'Gantt c', quantity: 250 });
    const file = await t.request({
      method: 'GET',
      url: `/media/${attachmentId}/read-url`,
      auth: repC?.auth,
    });
    expect(file.status).toBe(200);

    // GH#427: the same file also linked to a draft request must not hide it from an invited household.
    const draftEm = db.orm.em.fork();
    const draft = await draftEm.findOneOrFail(QuotationRequest, requestId);
    const extra = draftEm.create(QuotationRequest, {
      buyer: draft.buyer,
      design: 'Draft sharing the file',
      quantity: 10,
      unit: 'cốc',
      destination: 'Hà Nội',
      requiredBy: new Date(Date.now() + 20 * DAY),
      biddingClosesAt: new Date(Date.now() + 10 * DAY),
      invitedHouseholdIds: [],
      status: 'DRAFT',
    });
    await draftEm.flush();
    draftEm.create(MediaLink, {
      media: draftEm.getReference(MediaAsset, attachmentId),
      targetType: 'RFQ',
      targetId: extra.id,
      role: 'DOCUMENT',
      position: 0,
    });
    await draftEm.flush();
    const withDraftLink = await t.request({
      method: 'GET',
      url: `/media/${attachmentId}/read-url`,
      auth: repC?.auth,
    });
    expect(withDraftLink.status).toBe(200);
    // Production shares are already in progress. Recipients learn about the extra work without
    // being asked to confirm a proposal; the source household learns that its remaining work moved.
    const recipients = [
      { actor: representatives[0], expected: ['ALLOCATION_REASSIGNED'] },
      { actor: representatives[1], expected: ['ALLOCATION_INCREASED'] },
      { actor: representatives[2], expected: ['ALLOCATION_INCREASED'] },
      { actor: buyer, expected: [] },
      { actor: admin, expected: [] },
    ];
    for (const { actor, expected } of recipients) {
      const inbox = await t.request({
        method: 'GET',
        url: '/me/quotation-notices',
        auth: actor?.auth,
      });
      expect(inbox.status).toBe(200);
      expect(
        inbox.body
          .filter((notice: { requestId: string }) => notice.requestId === requestId)
          .map((notice: { kind: string }) => notice.kind),
      ).toEqual(expected);
    }
  });

  it('reports full and empty historical allocations without dividing by zero', async () => {
    const res = await t.request({
      method: 'GET',
      url: `/rfqs/${requestId}/allocations`,
      auth: buyer.auth,
    });
    expect(res.status).toBe(200);
    expect(res.body.find((share: { id: string }) => share.id === late.id)).toMatchObject({
      quantity: 200,
      completedQty: 200,
      progressPercent: 100,
      lateness: 'DONE',
    });
    // Fixture for an allocation whose entire unfinished quantity has been reassigned.
    await db.orm.em.fork().nativeUpdate(OrderAllocation, late.id, {
      quantity: 0,
      completedQty: 0,
      status: 'CANCELLED',
    });
    const empty = await t.request({
      method: 'GET',
      url: `/rfqs/${requestId}/allocations`,
      auth: buyer.auth,
    });
    expect(empty.status).toBe(200);
    expect(empty.body.find((share: { id: string }) => share.id === late.id)).toMatchObject({
      quantity: 0,
      completedQty: 0,
      progressPercent: 0,
    });
  });

  it('preserves the shared stopping stage for invited households after cancellation', async () => {
    await db.orm.em.fork().nativeUpdate(QuotationRequest, requestId, { status: 'CANCELLED' });
    const detail = await t.request({
      method: 'GET',
      url: `/rfqs/${requestId}`,
      auth: representatives[0]?.auth,
    });
    expect(detail.status).toBe(200);
    expect(detail.body).toMatchObject({
      status: 'CANCELLED',
      hasBids: true,
      invitedHouseholdIds: [households[0]?.id],
    });
    expect(detail.body).not.toHaveProperty('quotations');
    const invitations = await t.request({
      method: 'GET',
      url: '/me/invitations',
      auth: representatives[0]?.auth,
    });
    expect(invitations.body[0].request).toMatchObject({ status: 'CANCELLED', hasBids: true });
  });

  it('is for administrators only', async () => {
    const buyer = await t.createUser('BUYER');
    expect(
      (await t.request({ method: 'GET', url: '/admin/allocations', auth: buyer.auth })).status,
    ).toBe(403);
  });
});
