import { randomUUID } from 'node:crypto';
import { AppUser, Household, Product } from '@vcraft/database';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startTestApp, type TestApp } from './support/test-app.js';
import { startTestDatabase, type TestDatabase } from './support/test-database.js';

/** Smallest bytes `file-type` recognises as a PNG; the API does not decode images. */
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);

function multipart(bytes: Buffer, mime: string) {
  const boundary = `----vcraft${randomUUID()}`;
  const head = Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="logo"\r\nContent-Type: ${mime}\r\n\r\n`,
  );
  return {
    payload: Buffer.concat([head, bytes, Buffer.from(`\r\n--${boundary}--\r\n`)]),
    headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
  };
}

/** GH#243: custom requirements, attachments and the matching of households for a request sent to nobody. */
describe('request requirements, attachments and household matching', () => {
  let db: TestDatabase;
  let t: TestApp;
  let buyer: { auth: string };
  let otherBuyer: { auth: string };
  let admin: { auth: string };

  const day = 86_400_000;
  const body = (overrides: object = {}) => ({
    title: 'Logo cups',
    category: 'VASE',
    design: '100 vases',
    quantity: 100,
    unit: 'piece',
    destination: 'Hanoi',
    requiredBy: new Date(Date.now() + 20 * day).toISOString(),
    biddingClosesAt: new Date(Date.now() + 5 * day).toISOString(),
    invitedHouseholdIds: [],
    coordinationOptIn: false,
    ...overrides,
  });
  const create = (overrides: object = {}, auth = buyer.auth) =>
    t.request({ method: 'POST', url: '/rfqs', auth, body: body(overrides) });
  const submit = (request: { id: string; version: number }) =>
    t.request({
      method: 'POST',
      url: `/rfqs/${request.id}/submit`,
      auth: buyer.auth,
      headers: { 'if-match': String(request.version) },
    });
  const household = async (
    name: string,
    capacityByCategory?: Record<string, number>,
  ): Promise<{ auth: string; id: string; userId: string }> => {
    const rep = await t.createUser('BUYER');
    const applied = await t.request({
      method: 'POST',
      url: '/me/household',
      auth: rep.auth,
      body: { name, slug: name, history: '' },
    });
    expect(applied.status).toBe(201);
    const approved = await t.request({
      method: 'POST',
      url: `/admin/households/${applied.body.id}/approve`,
      auth: admin.auth,
      headers: { 'if-match': String(applied.body.version) },
    });
    expect(approved.status).toBe(200);
    if (capacityByCategory) {
      const patched = await t.request({
        method: 'PATCH',
        url: '/me/household',
        auth: rep.auth,
        headers: { 'if-match': String(approved.body.version) },
        body: { capacityByCategory },
      });
      expect(patched.status).toBe(200);
    }
    return { auth: rep.auth, id: applied.body.id, userId: rep.id };
  };
  const upload = async (auth: string, purpose: string, bytes = PNG, mime = 'image/png') => {
    const form = multipart(bytes, mime);
    const res = await t.app.inject({
      method: 'POST',
      url: `/api/v1/media?purpose=${purpose}`,
      headers: { authorization: auth, ...form.headers },
      payload: form.payload,
    });
    return { status: res.statusCode, body: res.body ? JSON.parse(res.body) : undefined };
  };

  beforeAll(async () => {
    db = await startTestDatabase();
    await db.migrate();
    t = await startTestApp(db);
    buyer = await t.createUser('BUYER');
    otherBuyer = await t.createUser('BUYER');
    admin = await t.createUser('ADMIN');
  }, 120_000);

  afterAll(async () => {
    await t?.close();
    await db?.stop();
  });

  describe('custom requirements', () => {
    it('round-trips through create, update, read and the invited household', async () => {
      const rep = await household('requirements-household', { VASE: 100 });
      const created = await create({
        invitedHouseholdIds: [rep.id],
        customRequirements: '  Print our logo in cobalt blue  ',
      });
      expect(created.status).toBe(201);
      expect(created.body.customRequirements).toBe('Print our logo in cobalt blue');
      expect(created.body.attachments).toEqual([]);

      const updated = await t.request({
        method: 'PUT',
        url: `/rfqs/${created.body.id}`,
        auth: buyer.auth,
        headers: { 'if-match': String(created.body.version) },
        body: body({ invitedHouseholdIds: [rep.id], customRequirements: 'Gift wrap each piece' }),
      });
      expect(updated.status).toBe(200);
      expect(updated.body.customRequirements).toBe('Gift wrap each piece');

      expect((await submit(updated.body)).status).toBe(200);
      const seen = await t.request({
        method: 'GET',
        url: `/rfqs/${created.body.id}`,
        auth: rep.auth,
      });
      expect(seen.body.customRequirements).toBe('Gift wrap each piece');

      const cleared = await create({ invitedHouseholdIds: [rep.id], customRequirements: '' });
      expect(cleared.body.customRequirements).toBeNull();
    });

    it('rejects text over 1000 characters', async () => {
      expect((await create({ customRequirements: 'x'.repeat(1001) })).status).toBe(422);
      expect((await create({ customRequirements: 'x'.repeat(1000) })).status).toBe(201);
    });
  });

  describe('attachments', () => {
    it('attaches up to three of the buyer own uploads and shows them to the invited household once sent', async () => {
      const rep = await household('attachment-household', { VASE: 100 });
      const stranger = await household('attachment-stranger', { VASE: 100 });
      const logo = await upload(buyer.auth, 'RFQ_ATTACHMENT');
      expect(logo.status).toBe(202);
      expect(logo.body).toMatchObject({ visibility: 'PRIVATE', status: 'READY' });
      const drawing = await upload(
        buyer.auth,
        'RFQ_ATTACHMENT',
        Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n'),
        'application/pdf',
      );
      expect(drawing.status).toBe(202);

      const created = await create({
        invitedHouseholdIds: [rep.id],
        attachments: [logo.body.id, drawing.body.id],
      });
      expect(created.status).toBe(201);
      expect(created.body.attachments).toEqual([
        { id: logo.body.id, mimeType: 'image/png', sizeBytes: PNG.byteLength },
        { id: drawing.body.id, mimeType: 'application/pdf', sizeBytes: expect.any(Number) },
      ]);

      // A draft is private to its buyer.
      const draftRead = await t.request({
        method: 'GET',
        url: `/media/${logo.body.id}/read-url`,
        auth: rep.auth,
      });
      expect(draftRead.status).toBe(404);

      expect((await submit(created.body)).status).toBe(200);
      const read = await t.request({
        method: 'GET',
        url: `/media/${logo.body.id}/read-url`,
        auth: rep.auth,
      });
      expect(read.status).toBe(200);
      expect(
        (
          await t.request({
            method: 'GET',
            url: `/media/${logo.body.id}/read-url`,
            auth: stranger.auth,
          })
        ).status,
      ).toBe(404);
      const request = await t.request({
        method: 'GET',
        url: `/rfqs/${created.body.id}`,
        auth: rep.auth,
      });
      expect(request.body.attachments.map((file: { id: string }) => file.id)).toEqual([
        logo.body.id,
        drawing.body.id,
      ]);
    });

    it('replaces and removes attachments of a draft', async () => {
      const first = await upload(buyer.auth, 'RFQ_ATTACHMENT');
      const created = await create({ attachments: [first.body.id], coordinationOptIn: true });
      expect(created.body.attachments).toHaveLength(1);
      const emptied = await t.request({
        method: 'PUT',
        url: `/rfqs/${created.body.id}`,
        auth: buyer.auth,
        headers: { 'if-match': String(created.body.version) },
        body: body({ coordinationOptIn: true, attachments: [] }),
      });
      expect(emptied.status).toBe(200);
      expect(emptied.body.attachments).toEqual([]);
    });

    it('lets a buyer upload request attachments only', async () => {
      expect((await upload(buyer.auth, 'RFQ_ATTACHMENT')).status).toBe(202);
      expect((await upload(buyer.auth, 'JOURNAL')).status).toBe(403);
      expect((await upload(buyer.auth, 'CERTIFICATE')).status).toBe(403);
      expect(
        (
          await upload(
            buyer.auth,
            'RFQ_ATTACHMENT',
            Buffer.from('<!doctype html><script>alert(1)</script>'),
            'text/html',
          )
        ).status,
      ).toBe(415);
    });

    it('refuses more than three, duplicates, other people files and other purposes', async () => {
      const mine = await upload(buyer.auth, 'RFQ_ATTACHMENT');
      const theirs = await upload(otherBuyer.auth, 'RFQ_ATTACHMENT');
      const journal = await upload(buyer.auth, 'JOURNAL');
      const ids = await Promise.all(
        [1, 2, 3].map(async (n) => {
          const bytes = Buffer.concat([PNG, Buffer.from(`${n}`)]);
          return (await upload(buyer.auth, 'RFQ_ATTACHMENT', bytes)).body.id as string;
        }),
      );
      expect(
        (await create({ coordinationOptIn: true, attachments: [...ids, mine.body.id] })).status,
      ).toBe(422);
      expect(
        (await create({ coordinationOptIn: true, attachments: [mine.body.id, mine.body.id] }))
          .status,
      ).toBe(422);
      expect(
        (await create({ coordinationOptIn: true, attachments: [theirs.body.id] })).status,
      ).toBe(422);
      expect(
        (await create({ coordinationOptIn: true, attachments: [journal.body.id] })).status,
      ).toBe(422);
      expect((await create({ coordinationOptIn: true, attachments: [randomUUID()] })).status).toBe(
        422,
      );
      expect((await create({ coordinationOptIn: true, attachments: ids })).status).toBe(201);
    });
  });

  describe('matching households when the buyer chose none', () => {
    let matched: Array<{ id: string; userId: string }> = [];

    beforeAll(async () => {
      // Twelve vase makers with rising capacity, plus households that must never be picked.
      matched = [];
      for (let index = 0; index < 12; index++) {
        const rep = await household(`vase-maker-${index}`, { VASE: 100 + index * 10 });
        matched.push({ id: rep.id, userId: rep.userId });
      }
      await household('tea-maker', { TEA: 900 });
      await household('zero-vase-capacity', { VASE: 0 });
      await household('no-capacity-data');
      const locked = await household('locked-vase-maker', { VASE: 5000 });
      const em = db.orm.em.fork();
      (await em.findOneOrFail(AppUser, locked.userId)).status = 'LOCKED';
      await em.flush();
    }, 240_000);

    it('invites the best ten of the category and tells the buyer how many', async () => {
      const draft = await create();
      expect(draft.status).toBe(201);
      expect(draft.body.invitedHouseholdIds).toEqual([]);
      const sent = await submit(draft.body);
      expect(sent.status).toBe(200);
      expect(sent.body.status).toBe('SENT');
      expect(sent.body.invitedHouseholdIds).toHaveLength(10);
      // The two weakest makers (capacity 100 and 110) are left out; the locked giant is skipped.
      const weakest = matched.slice(0, 2).map((household) => household.id);
      for (const id of sent.body.invitedHouseholdIds) expect(weakest).not.toContain(id);

      // A matched household was notified like any invited household.
      const invited = new Set<string>(sent.body.invitedHouseholdIds);
      const best = matched.find((household) => invited.has(household.id));
      expect(best).toBeDefined();
      const notices = await t.request({
        method: 'GET',
        url: '/me/quotation-notices',
        auth: `Bearer test:${best?.userId}`,
      });
      expect(
        notices.body.some(
          (notice: { kind: string; requestId: string }) =>
            notice.kind === 'RFQ_INVITED' && notice.requestId === sent.body.id,
        ),
      ).toBe(true);
    });

    it('keeps the households the buyer chose and does not match when coordination is requested', async () => {
      const chosen = matched[5] as { id: string };
      const chosenSend = await submit((await create({ invitedHouseholdIds: [chosen.id] })).body);
      expect(chosenSend.body.invitedHouseholdIds).toEqual([chosen.id]);
      const coordinated = await submit((await create({ coordinationOptIn: true })).body);
      expect(coordinated.body.invitedHouseholdIds).toEqual([]);
    });

    it('also matches households that sell a published product in the category', async () => {
      const seller = await household('tea-seller');
      const em = db.orm.em.fork();
      em.create(Product, {
        household: em.getReference(Household, seller.id),
        name: 'Tea pot',
        slug: 'tea-pot-match',
        traceCode: 'MATCHTEA',
        description: 'A pot',
        category: 'TEA',
        status: 'PUBLISHED',
      });
      await em.flush();
      const tea = await submit((await create({ category: 'TEA' })).body);
      expect(tea.status).toBe(200);
      expect(tea.body.invitedHouseholdIds).toContain(seller.id);
    });

    it('refuses to send a request nobody can take and leaves it a draft', async () => {
      const draft = await create({ category: 'WORSHIP' });
      expect(draft.status).toBe(201);
      const res = await submit(draft.body);
      expect(res.status).toBe(422);
      expect(res.body.code).toBe('RFQ_NO_MATCHING_HOUSEHOLD');
      const after = await t.request({
        method: 'GET',
        url: `/rfqs/${draft.body.id}`,
        auth: buyer.auth,
      });
      expect(after.body.status).toBe('DRAFT');
    });

    it('needs a category to match', async () => {
      const res = await create({ category: undefined });
      expect(res.status).toBe(422);
    });
  });
});
