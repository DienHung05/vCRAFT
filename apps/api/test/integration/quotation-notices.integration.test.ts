import { QuotationNoticeResponseSchema } from '@vcraft/contracts';
import { OutboxEvent } from '@vcraft/database';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startTestApp, type TestApp } from './support/test-app.js';
import { startTestDatabase, type TestDatabase } from './support/test-database.js';

type Party = 'buyer' | 'admin' | 'stranger' | 'repA' | 'repB' | 'repC';
type Expected = Partial<Record<Party, string[]>>;

describe('quotation notices: in-app inbox and mail outbox', () => {
  let db: TestDatabase;
  let t: TestApp;
  let users: Record<Party, { id: string; auth: string }>;
  let householdIds: Record<'repA' | 'repB' | 'repC', string>;
  const deadline = new Date(Date.now() + 86_400_000).toISOString();
  const completionDate = new Date(Date.now() + 10 * 86_400_000).toISOString();
  const requiredBy = new Date(Date.now() + 20 * 86_400_000).toISOString();
  const parties: Party[] = ['buyer', 'admin', 'stranger', 'repA', 'repB', 'repC'];

  beforeAll(async () => {
    db = await startTestDatabase();
    await db.migrate();
    t = await startTestApp(db);
    const admin = await t.createUser('ADMIN');
    users = {
      buyer: await t.createUser('BUYER'),
      admin,
      stranger: await t.createUser('BUYER'),
      repA: await t.createUser('BUYER'),
      repB: await t.createUser('BUYER'),
      repC: await t.createUser('BUYER'),
    };
    householdIds = {} as typeof householdIds;
    for (const name of ['repA', 'repB', 'repC'] as const) {
      const applied = await t.request({
        method: 'POST',
        url: '/me/household',
        auth: users[name].auth,
        body: {
          name: `notice-${name.toLowerCase()}`,
          slug: `notice-${name.toLowerCase()}`,
          history: '',
        },
      });
      expect(applied.status).toBe(201);
      const approved = await t.request({
        method: 'POST',
        url: `/admin/households/${applied.body.id}/approve`,
        auth: admin.auth,
        headers: { 'if-match': String(applied.body.version) },
      });
      expect(approved.status).toBe(200);
      householdIds[name] = applied.body.id;
    }
  });

  afterAll(async () => {
    await t?.close();
    await db?.stop();
  });

  async function inbox(party: Party) {
    const res = await t.request({
      method: 'GET',
      url: '/me/quotation-notices',
      auth: users[party].auth,
    });
    expect(res.status).toBe(200);
    return res.body as Array<{
      id: string;
      kind: string;
      requestId: string;
      readAt: string | null;
    }>;
  }

  async function outboxIds() {
    const events = await db.orm.em
      .fork()
      .find(OutboxEvent, { type: 'quotation.notice' }, { orderBy: { id: 'asc' } });
    return new Map(events.map((event) => [event.id, event.payload.noticeIds as string[]]));
  }

  /**
   * Chạy một bước nghiệp vụ rồi kiểm: mỗi bên nhận đúng các loại thông báo mong đợi (bên không liệt
   * kê phải không nhận gì), mỗi sự kiện ghi đúng một outbox `quotation.notice` khớp noticeIds.
   */
  async function step(requestId: string, action: () => Promise<unknown>, expected: Expected) {
    const seen = new Set<string>();
    for (const party of parties) for (const n of await inbox(party)) seen.add(n.id);
    const outboxBefore = await outboxIds();
    await action();
    const fresh = new Set<string>();
    for (const party of parties) {
      const added = (await inbox(party)).filter((n) => !seen.has(n.id));
      expect(added.every((n) => n.requestId === requestId)).toBe(true);
      expect(added.map((n) => n.kind).sort(), `notices for ${party}`).toEqual(
        [...(expected[party] ?? [])].sort(),
      );
      for (const n of added) fresh.add(n.id);
    }
    const newEvents = [...(await outboxIds())].filter(([id]) => !outboxBefore.has(id));
    const eventNoticeIds = newEvents.flatMap(([, ids]) => ids);
    expect(eventNoticeIds.sort()).toEqual([...fresh].sort());
    return newEvents.length;
  }

  async function currentVersion(requestId: string, party: Party = 'admin'): Promise<string> {
    const read = await t.request({
      method: 'GET',
      url: `/rfqs/${requestId}`,
      auth: users[party].auth,
    });
    expect(read.status).toBe(200);
    return String(read.body.version);
  }

  async function createDraft() {
    const created = await t.request({
      method: 'POST',
      url: '/rfqs',
      auth: users.buyer.auth,
      body: {
        design: 'Logo cups',
        quantity: 3500,
        unit: 'cup',
        destination: 'Ha Noi',
        requiredBy,
        biddingClosesAt: deadline,
        invitedHouseholdIds: [householdIds.repA, householdIds.repB],
        coordinationOptIn: true,
      },
    });
    expect(created.status).toBe(201);
    return created.body as { id: string; version: number };
  }

  async function submit(requestId: string, version: number) {
    const res = await t.request({
      method: 'POST',
      url: `/rfqs/${requestId}/submit`,
      auth: users.buyer.auth,
      headers: { 'if-match': String(version) },
    });
    expect(res.status).toBe(200);
  }

  async function coordinate(requestId: string) {
    const res = await t.request({
      method: 'POST',
      url: `/rfqs/${requestId}/coordinate`,
      auth: users.admin.auth,
      headers: { 'if-match': await currentVersion(requestId) },
    });
    expect(res.status).toBe(200);
  }

  async function contribute(requestId: string, party: 'repA' | 'repB') {
    const res = await t.request({
      method: 'POST',
      url: `/rfqs/${requestId}/contributions`,
      auth: users[party].auth,
      body: {
        maxQuantity: party === 'repA' ? 2000 : 1500,
        unitPriceVnd: 30_000,
        completionDate,
      },
    });
    expect(res.status).toBe(201);
    return res.body as { id: string; version: number };
  }

  async function quote(requestId: string) {
    const offers = await t.request({
      method: 'GET',
      url: `/rfqs/${requestId}/contributions`,
      auth: users.admin.auth,
    });
    const res = await t.request({
      method: 'POST',
      url: `/rfqs/${requestId}/quotations`,
      auth: users.admin.auth,
      headers: { 'if-match': await currentVersion(requestId) },
      body: {
        parts: offers.body
          .filter((offer: { status: string }) => offer.status === 'ACTIVE')
          .map(
            (offer: {
              householdId: string;
              maxQuantity: number;
              unitPriceVnd: number;
              completionDate: string;
              version: number;
            }) => ({
              householdId: offer.householdId,
              quantity: offer.maxQuantity,
              unitPriceVnd: offer.unitPriceVnd,
              completionDate: offer.completionDate,
              contributionVersion: offer.version,
            }),
          ),
        additionalChargeVnd: 0,
        deliveryTerms: 'INCLUDED',
      },
    });
    expect(res.status).toBe(201);
    return res.body.id as string;
  }

  async function allocationOf(requestId: string, party: 'repA' | 'repB') {
    const own = await t.request({
      method: 'GET',
      url: `/rfqs/${requestId}/allocations`,
      auth: users[party].auth,
    });
    expect(own.status).toBe(200);
    return own.body[0] as { id: string; version: number; quantity: number };
  }

  it('walks a request from invitation to receipt, notifying the right parties', async () => {
    const draft = await createDraft();
    const requestId = draft.id;

    // Mời ngay khi gửi: chỉ hai hộ ban đầu, không phải người mua.
    expect(
      await step(requestId, () => submit(requestId, draft.version), {
        repA: ['RFQ_INVITED'],
        repB: ['RFQ_INVITED'],
      }),
    ).toBe(1);

    await step(requestId, () => coordinate(requestId), {});

    // Mời thêm: chỉ hộ mới (repA đã được mời nên không nhận lần nữa).
    expect(
      await step(
        requestId,
        async () => {
          const res = await t.request({
            method: 'POST',
            url: `/rfqs/${requestId}/invitations`,
            auth: users.admin.auth,
            headers: { 'if-match': await currentVersion(requestId) },
            body: { householdIds: [householdIds.repA, householdIds.repC] },
          });
          expect(res.status).toBe(200);
        },
        { repC: ['RFQ_INVITED'] },
      ),
    ).toBe(1);

    let offerA!: { id: string; version: number };
    await step(
      requestId,
      async () => {
        offerA = await contribute(requestId, 'repA');
      },
      { admin: ['CONTRIBUTION_RECEIVED'] },
    );
    await step(requestId, () => contribute(requestId, 'repB'), {
      admin: ['CONTRIBUTION_RECEIVED'],
    });

    await step(requestId, () => quote(requestId), { buyer: ['QUOTATION_RECEIVED'] });

    // Hộ sửa đề xuất: admin biết đề xuất mới, người mua và admin biết chào giá bị rút.
    expect(
      await step(
        requestId,
        async () => {
          const res = await t.request({
            method: 'PUT',
            url: `/contributions/${offerA.id}`,
            auth: users.repA.auth,
            headers: { 'if-match': String(offerA.version) },
            body: { maxQuantity: 2000, unitPriceVnd: 29_000, completionDate },
          });
          expect(res.status).toBe(200);
        },
        {
          buyer: ['QUOTATION_WITHDRAWN'],
          admin: ['CONTRIBUTION_RECEIVED', 'QUOTATION_WITHDRAWN'],
        },
      ),
    ).toBe(2);

    let quotationId = '';
    await step(
      requestId,
      async () => {
        quotationId = await quote(requestId);
      },
      { buyer: ['QUOTATION_RECEIVED'] },
    );

    expect(
      await step(
        requestId,
        async () => {
          const res = await t.request({
            method: 'POST',
            url: `/rfqs/${requestId}/accept`,
            auth: users.buyer.auth,
            headers: { 'if-match': await currentVersion(requestId, 'buyer') },
            body: { quotationId },
          });
          expect(res.status).toBe(200);
        },
        {
          repA: ['ALLOCATION_PROPOSED'],
          repB: ['ALLOCATION_PROPOSED'],
          admin: ['QUOTATION_ACCEPTED'],
        },
      ),
    ).toBe(2);

    for (const party of ['repA', 'repB'] as const) {
      await step(
        requestId,
        async () => {
          const allocation = await allocationOf(requestId, party);
          const res = await t.request({
            method: 'POST',
            url: `/allocations/${allocation.id}/confirm`,
            auth: users[party].auth,
            headers: { 'if-match': String(allocation.version) },
          });
          expect(res.status).toBe(200);
        },
        { buyer: ['ALLOCATION_CONFIRMED'], admin: ['ALLOCATION_CONFIRMED'] },
      );
    }

    await step(
      requestId,
      async () => {
        const res = await t.request({
          method: 'POST',
          url: `/rfqs/${requestId}/start-production`,
          auth: users.admin.auth,
          headers: { 'if-match': await currentVersion(requestId) },
        });
        expect(res.status).toBe(200);
      },
      { buyer: ['PRODUCTION_STARTED'], repA: ['PRODUCTION_STARTED'], repB: ['PRODUCTION_STARTED'] },
    );

    for (const party of ['repA', 'repB'] as const) {
      await step(
        requestId,
        async () => {
          const allocation = await allocationOf(requestId, party);
          const res = await t.request({
            method: 'POST',
            url: `/allocations/${allocation.id}/progress`,
            auth: users[party].auth,
            headers: { 'if-match': String(allocation.version) },
            body: { completedQty: allocation.quantity },
          });
          expect(res.status).toBe(200);
        },
        { buyer: ['PROGRESS_REPORTED'], admin: ['PROGRESS_REPORTED'] },
      );
    }

    await step(
      requestId,
      async () => {
        const res = await t.request({
          method: 'POST',
          url: `/rfqs/${requestId}/receive`,
          auth: users.buyer.auth,
          headers: { 'if-match': await currentVersion(requestId, 'buyer') },
        });
        expect(res.status).toBe(200);
      },
      { admin: ['ORDER_RECEIVED'], repA: ['ORDER_RECEIVED'], repB: ['ORDER_RECEIVED'] },
    );

    // Người lạ (và hộ chưa tham gia đơn) không thấy gì của đơn này.
    expect(await inbox('stranger')).toEqual([]);
    expect((await inbox('repC')).map((n) => n.kind)).toEqual(['RFQ_INVITED']);
  });

  async function acceptedOrder() {
    const draft = await createDraft();
    await submit(draft.id, draft.version);
    await coordinate(draft.id);
    await contribute(draft.id, 'repA');
    await contribute(draft.id, 'repB');
    const quotationId = await quote(draft.id);
    const res = await t.request({
      method: 'POST',
      url: `/rfqs/${draft.id}/accept`,
      auth: users.buyer.auth,
      headers: { 'if-match': await currentVersion(draft.id, 'buyer') },
      body: { quotationId },
    });
    expect(res.status).toBe(200);
    return draft.id;
  }

  it('tells every other party when a household declines', async () => {
    const requestId = await acceptedOrder();
    await step(
      requestId,
      async () => {
        const allocation = await allocationOf(requestId, 'repB');
        const res = await t.request({
          method: 'POST',
          url: `/allocations/${allocation.id}/decline`,
          auth: users.repB.auth,
          headers: { 'if-match': String(allocation.version) },
        });
        expect(res.status).toBe(200);
      },
      { buyer: ['ORDER_CANCELLED'], admin: ['ORDER_CANCELLED'], repA: ['ORDER_CANCELLED'] },
    );
  });

  it('tells buyer and households when the coordinator cancels', async () => {
    const requestId = await acceptedOrder();
    await step(
      requestId,
      async () => {
        const res = await t.request({
          method: 'POST',
          url: `/rfqs/${requestId}/cancel`,
          auth: users.admin.auth,
          headers: { 'if-match': await currentVersion(requestId) },
          body: { reason: 'Khách đổi kế hoạch' },
        });
        expect(res.status).toBe(200);
      },
      { buyer: ['ORDER_CANCELLED'], repA: ['ORDER_CANCELLED'], repB: ['ORDER_CANCELLED'] },
    );
  });

  it('marks notices read for the owner only', async () => {
    const before = await inbox('repA');
    expect(before.length).toBeGreaterThan(2);
    for (const notice of before) {
      expect(QuotationNoticeResponseSchema.safeParse(notice).success).toBe(true);
      expect(notice.readAt).toBeNull();
    }
    const [first] = before;
    if (!first) throw new Error('inbox empty');

    const read = await t.request({
      method: 'POST',
      url: `/me/quotation-notices/${first.id}/read`,
      auth: users.repA.auth,
    });
    expect(read.status).toBe(200);
    expect(read.body.id).toBe(first.id);
    expect(read.body.readAt).toEqual(expect.any(String));
    const again = await t.request({
      method: 'POST',
      url: `/me/quotation-notices/${first.id}/read`,
      auth: users.repA.auth,
    });
    expect(again.status).toBe(200);
    expect(again.body.readAt).toBe(read.body.readAt);

    // Người khác (kể cả người lạ) không đọc được thông báo của repA.
    for (const party of ['buyer', 'stranger'] as const) {
      const foreign = await t.request({
        method: 'POST',
        url: `/me/quotation-notices/${first.id}/read`,
        auth: users[party].auth,
      });
      expect(foreign.status).toBe(404);
    }
    const unknown = await t.request({
      method: 'POST',
      url: `/me/quotation-notices/${crypto.randomUUID()}/read`,
      auth: users.repA.auth,
    });
    expect(unknown.status).toBe(404);

    const buyerUnread = (await inbox('buyer')).filter((n) => !n.readAt).length;
    const all = await t.request({
      method: 'POST',
      url: '/me/quotation-notices/read-all',
      auth: users.repA.auth,
    });
    expect(all.status).toBe(200);
    expect(all.body).toEqual({ updated: before.length - 1 });
    const after = await inbox('repA');
    expect(after.every((n) => n.readAt !== null)).toBe(true);
    expect(
      (
        await t.request({
          method: 'POST',
          url: '/me/quotation-notices/read-all',
          auth: users.repA.auth,
        })
      ).body,
    ).toEqual({ updated: 0 });

    // Đánh dấu của repA không đụng tới hộp thư người khác.
    expect((await inbox('buyer')).filter((n) => !n.readAt)).toHaveLength(buyerUnread);
    const strangerAll = await t.request({
      method: 'POST',
      url: '/me/quotation-notices/read-all',
      auth: users.stranger.auth,
    });
    expect(strangerAll.body).toEqual({ updated: 0 });
    expect(await inbox('stranger')).toEqual([]);
  });

  it('lists newest first and requires a session', async () => {
    const list = await inbox('buyer');
    const times = list.map((n) => n.id);
    expect([...times].sort().reverse()).toEqual(times);
    const anonymous = await t.request({ method: 'GET', url: '/me/quotation-notices' });
    expect(anonymous.status).toBe(401);
  });
});
