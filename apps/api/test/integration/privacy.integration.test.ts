import { DataExportSchema } from '@vcraft/contracts';
import {
  AccountInvitation,
  AppUser,
  Artisan,
  AuditLog,
  ConsentRecord,
  CooperativeQuotation,
  Household,
  HouseholdRating,
  JournalEntry,
  LoginEvent,
  MediaAsset,
  News,
  Notification,
  OrderAllocation,
  OutboxEvent,
  Payment,
  Product,
  ProductFavourite,
  QuotationRequest,
  Workshop,
} from '@vcraft/database';
import { verifyChain } from '@vcraft/domain';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  ANONYMOUS_RATER_ID,
  REDACTED_PAYMENT_EVENT,
  REMOVED_ADDRESS,
} from '../../src/modules/privacy/application/account-deletion.service.js';
import { toChainEntry } from '../../src/modules/production-logs/application/journal.queries.js';
import { startTestApp, type TestApp } from './support/test-app.js';
import { startTestDatabase, type TestDatabase } from './support/test-database.js';

const PDF = Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n');
const PHOTO_SHA = 'b'.repeat(64);
const POLICY = '2026-11-01';
const DAY = 86_400_000;

/**
 * vCRAFT-83g.31 (NFR-SEC-07): recorded consent, the personal data export and self-service deletion,
 * through HTTP on a real database. Supabase Auth is replaced by a fake that records deletions.
 */
describe('Personal data: consent, export and deletion', () => {
  let db: TestDatabase;
  let t: TestApp;
  let admin: { id: string; auth: string };

  beforeAll(async () => {
    db = await startTestDatabase();
    await db.migrate();
    t = await startTestApp(db);
    admin = await t.createUser('ADMIN');
  }, 240_000);

  afterAll(async () => {
    await t?.close();
    await db?.stop();
  });

  const rfqBody = (overrides: object = {}) => ({
    title: 'Logo cups',
    design: '100 cups with a printed logo',
    quantity: 100,
    unit: 'cup',
    destination: '12 Secret Street, Hanoi',
    requiredBy: new Date(Date.now() + 20 * DAY).toISOString(),
    biddingClosesAt: new Date(Date.now() + 5 * DAY).toISOString(),
    coordinationOptIn: true,
    ...overrides,
  });
  const createRfq = async (auth: string, overrides: object = {}) => {
    const res = await t.request({ method: 'POST', url: '/rfqs', auth, body: rfqBody(overrides) });
    expect(res.status).toBe(201);
    return res.body as { id: string; version: number };
  };
  const upload = (auth: string, purpose: string, bytes: Buffer, mime: string) => {
    const boundary = 'vcraftboundary';
    return t.app.inject({
      method: 'POST',
      url: `/api/v1/media?purpose=${purpose}`,
      headers: { authorization: auth, 'content-type': `multipart/form-data; boundary=${boundary}` },
      payload: Buffer.concat([
        Buffer.from(
          `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="f"\r\nContent-Type: ${mime}\r\n\r\n`,
        ),
        bytes,
        Buffer.from(`\r\n--${boundary}--\r\n`),
      ]),
    });
  };
  const consent = (auth: string, purpose: string, policyVersion = POLICY) =>
    t.request({ method: 'POST', url: '/me/consents', auth, body: { purpose, policyVersion } });
  const remove = (auth: string | undefined, confirmation: string) =>
    t.request({ method: 'DELETE', url: '/me', ...(auth && { auth }), body: { confirmation } });

  /** An approved household with a workshop, an artisan, a product with a journal and an ID document. */
  async function approvedHousehold(label: string) {
    const rep = await t.createUser('BUYER');
    const applied = await t.request({
      method: 'POST',
      url: '/me/household',
      auth: rep.auth,
      body: { name: `Household ${label}`, slug: `household-${label}`, history: `History ${label}` },
    });
    expect(applied.status).toBe(201);
    const workshop = await t.request({
      method: 'POST',
      url: '/me/household/workshops',
      auth: rep.auth,
      body: { name: `Workshop ${label}`, address: `${label} Workshop Lane` },
    });
    expect(workshop.status).toBe(201);
    const approved = await t.request({
      method: 'POST',
      url: `/admin/households/${applied.body.id}/approve`,
      auth: admin.auth,
      headers: { 'if-match': `"${applied.body.version}"` },
    });
    expect(approved.status).toBe(200);
    const artisan = await t.request({
      method: 'POST',
      url: '/me/household/artisans',
      auth: rep.auth,
      body: { name: `Artisan ${label}`, craftRole: 'Thrower' },
    });
    expect(artisan.status).toBe(201);
    const product = await t.request({
      method: 'POST',
      url: '/me/household/products',
      auth: rep.auth,
      body: { name: `Vase ${label}` },
    });
    expect(product.status).toBe(201);
    // A public photo the journal entry points to (hash-chained), owned by the representative.
    const em = db.orm.em.fork();
    const photo = em.create(MediaAsset, {
      ownerId: rep.id,
      purpose: 'JOURNAL',
      visibility: 'PUBLIC',
      status: 'READY',
      mimeType: 'image/webp',
      sizeBytes: 10,
      sha256: PHOTO_SHA.replace(/b/g, label === 'a' ? 'b' : 'c'),
      originalKey: `originals/${rep.id}/photo`,
      variants: [
        { format: 'webp', width: 1280, height: 800, key: `v/${rep.id}-1280.webp`, bytes: 1 },
      ],
    });
    await em.flush();
    // Journal photos must be the household's own processed uploads (GH#237).
    const photoUrl = (await t.request({ method: 'GET', url: `/media/${photo.id}`, auth: rep.auth }))
      .body.variants[0].url as string;
    await t.storage.put({
      bucket: 'private',
      key: photo.originalKey,
      body: new Uint8Array([1]),
      contentType: 'image/webp',
    });
    const journal = await t.request({
      method: 'POST',
      url: `/me/household/products/${product.body.id}/journal`,
      auth: rep.auth,
      body: {
        stage: 'clay',
        declaredDate: '2026-09-02',
        note: `Clay notes ${label}`,
        images: [{ url: photoUrl, sha256: photo.sha256 }],
      },
    });
    expect(journal.status).toBe(201);
    const doc = await upload(rep.auth, 'CERTIFICATE', PDF, 'application/pdf');
    expect(doc.statusCode).toBe(202);
    return {
      ...rep,
      householdId: applied.body.id as string,
      slug: `household-${label}`,
      productId: product.body.id as string,
      traceCode: product.body.traceCode as string,
      photoId: photo.id,
      documentId: JSON.parse(doc.body).id as string,
    };
  }

  describe('recorded consent', () => {
    it('refuses personal-data actions until consent is recorded, then allows them', async () => {
      const user = await t.createUser('BUYER', { consent: false });

      const apply = () =>
        t.request({
          method: 'POST',
          url: '/me/household',
          auth: user.auth,
          body: { name: 'Consent Household', slug: 'consent-household', history: '' },
        });
      const refusedApply = await apply();
      expect(refusedApply.status).toBe(403);
      expect(refusedApply.body.code).toBe('CONSENT_REQUIRED');
      expect((await consent(user.auth, 'SIGN_UP')).status).toBe(201);
      expect((await apply()).status).toBe(201);

      // Identity papers need their own consent.
      const refusedUpload = await upload(user.auth, 'CERTIFICATE', PDF, 'application/pdf');
      expect(refusedUpload.statusCode).toBe(403);
      expect(JSON.parse(refusedUpload.body).code).toBe('CONSENT_REQUIRED');
      expect(await db.orm.em.fork().count(MediaAsset, { ownerId: user.id })).toBe(0);
      await consent(user.auth, 'ID_DOCUMENT');
      expect((await upload(user.auth, 'CERTIFICATE', PDF, 'application/pdf')).statusCode).toBe(202);

      // Maker names are published, so they need consent too.
      const artisan = () =>
        t.request({
          method: 'POST',
          url: '/me/household/artisans',
          auth: user.auth,
          body: { name: 'New maker' },
        });
      expect((await artisan()).body.code).toBe('CONSENT_REQUIRED');
      await consent(user.auth, 'MAKER_PROFILE');
      expect((await artisan()).status).toBe(201);
    });

    it('refuses a quotation request without RFQ_CONTACT consent', async () => {
      const buyer = await t.createUser('BUYER', { consent: false });
      const refused = await t.request({
        method: 'POST',
        url: '/rfqs',
        auth: buyer.auth,
        body: rfqBody(),
      });
      expect(refused.status).toBe(403);
      expect(refused.body.code).toBe('CONSENT_REQUIRED');
      await consent(buyer.auth, 'RFQ_CONTACT');
      expect(
        (await t.request({ method: 'POST', url: '/rfqs', auth: buyer.auth, body: rfqBody() }))
          .status,
      ).toBe(201);
    });

    it('records who consented to what, under which policy version and when; repeating is a no-op', async () => {
      const user = await t.createUser('BUYER', { consent: false });
      const first = await consent(user.auth, 'RFQ_CONTACT');
      expect(first.status).toBe(201);
      expect(first.body).toMatchObject({ purpose: 'RFQ_CONTACT', policyVersion: POLICY });
      expect(Number.isNaN(Date.parse(first.body.givenAt))).toBe(false);
      const again = await consent(user.auth, 'RFQ_CONTACT');
      expect(again.body.id).toBe(first.body.id);

      const rows = await db.orm.em.fork().find(ConsentRecord, { userId: user.id });
      expect(rows).toHaveLength(1);
      const list = await t.request({ method: 'GET', url: '/me/consents', auth: user.auth });
      expect(list.status).toBe(200);
      expect(list.body.currentPolicyVersion).toBe(POLICY);
      expect(list.body.data).toHaveLength(1);
    });

    it('records SIGN_UP consent from the sign-up form when the account is first created', async () => {
      const withConsent = `Bearer test:${crypto.randomUUID()}|consent=${POLICY}`;
      expect((await t.request({ method: 'GET', url: '/me', auth: withConsent })).status).toBe(200);
      const list = await t.request({ method: 'GET', url: '/me/consents', auth: withConsent });
      expect(list.body.data).toHaveLength(1);
      expect(list.body.data[0]).toMatchObject({ purpose: 'SIGN_UP', policyVersion: POLICY });

      const outdated = `Bearer test:${crypto.randomUUID()}|consent=2020-01-01`;
      await t.request({ method: 'GET', url: '/me', auth: outdated });
      expect(
        (await t.request({ method: 'GET', url: '/me/consents', auth: outdated })).body.data,
      ).toEqual([]);
    });

    it('rejects an outdated policy version, an unknown purpose and a missing token', async () => {
      const user = await t.createUser('BUYER', { consent: false });
      const old = await consent(user.auth, 'SIGN_UP', '2020-01-01');
      expect(old.status).toBe(422);
      expect(old.body.errors[0].path).toBe('policyVersion');
      expect((await consent(user.auth, 'MARKETING')).status).toBe(422);
      expect(
        (
          await t.request({
            method: 'POST',
            url: '/me/consents',
            body: { purpose: 'SIGN_UP', policyVersion: POLICY },
          })
        ).status,
      ).toBe(401);
      expect((await t.request({ method: 'GET', url: '/me/consents' })).status).toBe(401);
    });

    it("one person's consent never counts for another", async () => {
      const consenting = await t.createUser('BUYER', { consent: false });
      const other = await t.createUser('BUYER', { consent: false });
      await consent(consenting.auth, 'RFQ_CONTACT');
      const res = await t.request({
        method: 'POST',
        url: '/rfqs',
        auth: other.auth,
        body: rfqBody(),
      });
      expect(res.status).toBe(403);
    });
  });

  /** A delivered order with a payment, a rating, a favourite, a sign-in and an invitation for `buyer`. */
  async function seedBuyerHistory(
    buyer: { id: string; email: string },
    target: { householdId: string; productId: string },
    tag: string,
  ) {
    const em = db.orm.em.fork();
    const request = em.create(QuotationRequest, {
      buyer: em.getReference(AppUser, buyer.id),
      title: `Order ${tag}`,
      design: 'Design',
      quantity: 1,
      unit: 'pc',
      destination: 'Somewhere',
      requiredBy: new Date(Date.now() - 2 * DAY),
      biddingClosesAt: new Date(Date.now() - 10 * DAY),
      status: 'DELIVERED',
    } as never);
    await em.flush();
    const payment = em.create(Payment, {
      order: request,
      kind: 'DEPOSIT',
      method: 'SEPAY_TRANSFER',
      provider: 'SEPAY',
      amountVnd: 150_000,
      referenceCode: `REF-${tag}`,
      status: 'PAID',
      paidAt: new Date(),
      rawLastEvent: { content: `Nguyen Van A chuyen khoan ${tag}` },
      note: `note-${tag}`,
      refundReason: `reason-${tag}`,
    } as never);
    em.create(HouseholdRating, {
      request,
      household: em.getReference(Household, target.householdId),
      raterId: buyer.id,
      stars: 4,
      comment: `comment-${tag}`,
    });
    em.create(ProductFavourite, {
      userId: buyer.id,
      product: em.getReference(Product, target.productId),
    });
    em.create(LoginEvent, {
      userId: buyer.id,
      sessionId: `session-${tag}`,
      method: 'password',
      aal: 'aal1',
      browser: 'Chrome',
      country: 'VN',
    });
    const invitation = em.create(AccountInvitation, {
      email: buyer.email.toLowerCase(),
      role: 'BUYER',
      invitedBy: admin.id,
    });
    await em.flush();
    em.create(AuditLog, {
      actorId: admin.id,
      action: 'user.invite',
      entity: 'account_invitation',
      entityId: invitation.id,
      before: null,
      after: { email: buyer.email.toLowerCase(), role: 'BUYER', status: 'PENDING' },
    });
    await em.flush();
    return { requestId: request.id, paymentId: payment.id, invitationId: invitation.id };
  }

  describe('GET /me/data-export', () => {
    it('requires a signed-in user', async () => {
      expect((await t.request({ method: 'GET', url: '/me/data-export' })).status).toBe(401);
      expect(
        (await t.request({ method: 'GET', url: '/me/data-export', auth: 'Bearer nope' })).status,
      ).toBe(401);
    });

    it("returns the household owner's own data, and none of anyone else's", async () => {
      const mine = await approvedHousehold('exp-a');
      const theirs = await approvedHousehold('exp-b');
      const theirBuyer = await t.createUser('BUYER');
      await createRfq(theirBuyer.auth, { destination: 'THEIR-SECRET-ADDRESS' });
      await t.request({
        method: 'POST',
        url: `/admin/households/${mine.householdId}/request-info`,
        auth: admin.auth,
        headers: { 'if-match': '"1"' },
        body: { reason: 'please add papers' },
      });

      const res = await t.request({ method: 'GET', url: '/me/data-export', auth: mine.auth });
      expect(res.status).toBe(200);
      const doc = DataExportSchema.parse(res.body);

      expect(doc.account).toMatchObject({ id: mine.id, role: 'HOUSEHOLD' });
      expect(doc.household?.profile).toMatchObject({
        name: 'Household exp-a',
        history: 'History exp-a',
      });
      expect(doc.household?.workshops).toHaveLength(1);
      expect(doc.household?.artisans).toHaveLength(1);
      const products = doc.household?.products as { name: string; journal: { note: string }[] }[];
      expect(products).toHaveLength(1);
      expect(products[0]?.journal[0]?.note).toBe('Clay notes exp-a');
      expect(doc.consents.map((c) => c.purpose).sort()).toEqual([
        'ID_DOCUMENT',
        'MAKER_PROFILE',
        'RFQ_CONTACT',
        'SIGN_UP',
      ]);
      // The ID document is listed with a signed link that works; the other household's is not there.
      const idDocument = doc.media.find((m) => m.id === mine.documentId);
      expect(idDocument).toMatchObject({ purpose: 'CERTIFICATE', visibility: 'PRIVATE' });
      expect(idDocument?.url).toContain('signature=');
      expect(idDocument?.urlExpiresAt).not.toBeNull();
      expect(doc.media.some((m) => m.id === theirs.documentId)).toBe(false);

      const text = JSON.stringify(res.body);
      for (const foreign of [
        theirs.id,
        theirs.householdId,
        theirs.productId,
        theirs.traceCode,
        theirs.photoId,
        theirs.documentId,
        theirBuyer.id,
        'exp-b',
        'THEIR-SECRET-ADDRESS',
      ]) {
        expect(text, foreign).not.toContain(foreign);
      }
    });

    it("exports a buyer's payments, ratings given, favourites and sign-in history, and only their own", async () => {
      const target = await approvedHousehold('exp-r');
      const buyer = await t.createUser('BUYER');
      const other = await t.createUser('BUYER');
      await seedBuyerHistory(buyer, target, 'mine');
      await seedBuyerHistory(other, target, 'theirs');

      const res = await t.request({ method: 'GET', url: '/me/data-export', auth: buyer.auth });
      const doc = DataExportSchema.parse(res.body);
      expect(doc.payments).toHaveLength(1);
      expect(doc.payments[0]).toMatchObject({
        kind: 'DEPOSIT',
        method: 'SEPAY_TRANSFER',
        status: 'PAID',
        amountVnd: 150_000,
        note: 'note-mine',
        refundReason: 'reason-mine',
      });
      expect(doc.ratingsGiven).toEqual([
        expect.objectContaining({ stars: 4, comment: 'comment-mine' }),
      ]);
      expect(doc.favourites).toEqual([expect.objectContaining({ productId: target.productId })]);
      expect(doc.signIns).toEqual([
        expect.objectContaining({ method: 'password', browser: 'Chrome', country: 'VN' }),
      ]);
      const text = JSON.stringify(res.body);
      expect(text).not.toContain('chuyen khoan');
      expect(text).not.toContain('theirs');
    });

    it("returns a buyer's requests and notifications", async () => {
      const buyer = await t.createUser('BUYER');
      const other = await t.createUser('BUYER');
      const draft = await createRfq(buyer.auth, { destination: 'MY-ADDRESS' });
      await createRfq(other.auth, { destination: 'OTHER-ADDRESS' });
      const em = db.orm.em.fork();
      em.create(Notification, { recipientId: buyer.id, type: 'HOUSEHOLD_APPROVED' });
      em.create(Notification, { recipientId: other.id, type: 'HOUSEHOLD_REJECTED' });
      await em.flush();

      const res = await t.request({ method: 'GET', url: '/me/data-export', auth: buyer.auth });
      const doc = DataExportSchema.parse(res.body);
      expect(doc.household).toBeNull();
      expect(doc.quotationRequests).toHaveLength(1);
      expect(doc.quotationRequests[0]).toMatchObject({ id: draft.id, destination: 'MY-ADDRESS' });
      expect(doc.notifications).toHaveLength(1);
      expect(JSON.stringify(res.body)).not.toContain('OTHER-ADDRESS');
    });
  });

  describe('DELETE /me', () => {
    it('requires a signed-in user and the typed email', async () => {
      expect((await remove(undefined, 'x@y.z')).status).toBe(401);
      const user = await t.createUser('BUYER');
      const wrong = await remove(user.auth, 'someone-else@test.local');
      expect(wrong.status).toBe(422);
      expect(wrong.body.errors[0].path).toBe('confirmation');
      expect(t.authAdmin.deleted).not.toContain(user.id);
      expect((await db.orm.em.fork().findOneOrFail(AppUser, user.id)).status).toBe('ACTIVE');
    });

    it('refuses administrator accounts', async () => {
      const other = await t.createUser('ADMIN');
      const res = await remove(other.auth, other.email);
      expect(res.status).toBe(409);
      expect(res.body.code).toBe('ACCOUNT_DELETION_ADMIN');
      expect(t.authAdmin.deleted).not.toContain(other.id);
    });

    it('is blocked for a buyer with an order in progress, and nothing changes', async () => {
      const buyer = await t.createUser('BUYER');
      const request = await createRfq(buyer.auth);
      const em = db.orm.em.fork();
      (await em.findOneOrFail(QuotationRequest, request.id)).status = 'IN_PRODUCTION';
      await em.flush();

      const res = await remove(buyer.auth, buyer.email);
      expect(res.status).toBe(409);
      expect(res.body.code).toBe('ACCOUNT_DELETION_ACTIVE_ORDERS');
      const user = await db.orm.em.fork().findOneOrFail(AppUser, buyer.id);
      expect(user).toMatchObject({ status: 'ACTIVE', email: buyer.email });
      expect(await db.orm.em.fork().count(ConsentRecord, { userId: buyer.id })).toBeGreaterThan(0);
      expect(t.authAdmin.deleted).not.toContain(buyer.id);
    });

    it('is blocked for a household with an allocation in progress', async () => {
      const rep = await approvedHousehold('block');
      const buyer = await t.createUser('BUYER');
      const request = await createRfq(buyer.auth);
      const em = db.orm.em.fork();
      const quotation = em.create(CooperativeQuotation, {
        request: em.getReference(QuotationRequest, request.id),
        status: 'ACCEPTED',
        quantity: 100,
        parts: [],
        productionTotalVnd: 100,
        totalVnd: 100,
        deliveryTerms: 'INCLUDED',
      });
      em.create(OrderAllocation, {
        quotation,
        household: em.getReference(Household, rep.householdId),
        quantity: 100,
        status: 'CONFIRMED',
      });
      await em.flush();

      const res = await remove(rep.auth, rep.email);
      expect(res.status).toBe(409);
      expect(res.body.code).toBe('ACCOUNT_DELETION_ACTIVE_ORDERS');
      expect((await db.orm.em.fork().findOneOrFail(Household, rep.householdId)).name).toBe(
        'Household block',
      );
    });

    it('rolls everything back when Supabase refuses to delete the auth user', async () => {
      const buyer = await t.createUser('BUYER');
      await createRfq(buyer.auth);
      t.authAdmin.failWith = new Error('supabase down');
      const res = await remove(buyer.auth, buyer.email);
      t.authAdmin.failWith = null;
      expect(res.status).toBeGreaterThanOrEqual(500);
      expect(await db.orm.em.fork().findOneOrFail(AppUser, buyer.id)).toMatchObject({
        status: 'ACTIVE',
        email: buyer.email,
      });
      expect(await db.orm.em.fork().count(QuotationRequest, { buyer: buyer.id })).toBe(1);
      expect(await db.orm.em.fork().count(AuditLog, { entityId: buyer.id })).toBe(0);
      // And the person can still delete once Supabase is back.
      expect((await remove(buyer.auth, buyer.email)).status).toBe(204);
    });

    it('deletes a buyer: drafts go, open requests are cancelled, past requests lose the address', async () => {
      const buyer = await t.createUser('BUYER');
      const bystander = await t.createUser('BUYER');
      const bystanderRequest = await createRfq(bystander.auth, { destination: 'KEEP-ME' });
      const draft = await createRfq(buyer.auth);
      const open = await createRfq(buyer.auth);
      const delivered = await createRfq(buyer.auth);
      const em = db.orm.em.fork();
      (await em.findOneOrFail(QuotationRequest, open.id)).status = 'BIDDING';
      (await em.findOneOrFail(QuotationRequest, delivered.id)).status = 'DELIVERED';
      em.create(Notification, { recipientId: buyer.id, type: 'HOUSEHOLD_APPROVED' });
      await em.flush();

      const res = await remove(buyer.auth, buyer.email.toUpperCase());
      expect(res.status).toBe(204);

      const check = db.orm.em.fork();
      const user = await check.findOneOrFail(AppUser, buyer.id);
      expect(user).toMatchObject({
        status: 'DELETED',
        email: `deleted-${buyer.id}@deleted.invalid`,
        fullName: null,
      });
      expect(await check.findOne(QuotationRequest, draft.id)).toBeNull();
      expect(await check.findOneOrFail(QuotationRequest, open.id)).toMatchObject({
        status: 'CANCELLED',
        destination: REMOVED_ADDRESS,
      });
      expect(await check.findOneOrFail(QuotationRequest, delivered.id)).toMatchObject({
        status: 'DELIVERED',
        destination: REMOVED_ADDRESS,
      });
      expect(await check.count(ConsentRecord, { userId: buyer.id })).toBe(0);
      expect(await check.count(Notification, { recipientId: buyer.id })).toBe(0);
      // Someone else's data is untouched.
      expect(await check.findOneOrFail(QuotationRequest, bystanderRequest.id)).toMatchObject({
        destination: 'KEEP-ME',
      });

      expect(t.authAdmin.deleted).toContain(buyer.id);
      const audit = await check.findOneOrFail(AuditLog, {
        action: 'account.delete',
        entityId: buyer.id,
      });
      expect(audit.actorId).toBe(buyer.id);
      expect(JSON.stringify(audit)).not.toContain('@test.local');

      // The token still verifies at Supabase for up to an hour, but the API turns it away.
      expect((await t.request({ method: 'GET', url: '/me', auth: buyer.auth })).status).toBe(401);
      expect(
        (await t.request({ method: 'GET', url: '/me/data-export', auth: buyer.auth })).status,
      ).toBe(401);
      // The audit log screen shows no name for the deleted actor.
      const log = await t.request({
        method: 'GET',
        url: '/admin/audit-log?action=account.delete',
        auth: admin.auth,
      });
      expect(log.status).toBe(200);
      expect(
        log.body.data.find((row: { actorId: string }) => row.actorId === buyer.id),
      ).toMatchObject({ actorName: null });
    });

    it('scrubs payment payloads, rating comments and the invitation, and keeps amounts and scores', async () => {
      const target = await approvedHousehold('del-r');
      const buyer = await t.createUser('BUYER');
      const seeded = await seedBuyerHistory(buyer, target, 'gone');

      expect((await remove(buyer.auth, buyer.email)).status).toBe(204);

      const check = db.orm.em.fork();
      expect(await check.findOneOrFail(Payment, seeded.paymentId)).toMatchObject({
        amountVnd: 150_000,
        status: 'PAID',
        kind: 'DEPOSIT',
        rawLastEvent: REDACTED_PAYMENT_EVENT,
        note: null,
        refundReason: null,
      });
      const rating = await check.findOneOrFail(HouseholdRating, { request: seeded.requestId });
      expect(rating).toMatchObject({ stars: 4, comment: null, raterId: ANONYMOUS_RATER_ID });
      expect(await check.count(ProductFavourite, { userId: buyer.id })).toBe(0);
      expect(await check.count(LoginEvent, { userId: buyer.id })).toBe(0);
      expect(await check.findOne(AccountInvitation, seeded.invitationId)).toBeNull();
      const invite = await check.findOneOrFail(AuditLog, {
        action: 'user.invite',
        entityId: seeded.invitationId,
      });
      expect(JSON.stringify(invite)).not.toContain(buyer.email.toLowerCase());
      expect(invite.after).toMatchObject({ role: 'BUYER', status: 'PENDING' });
    });

    it('deletes a household: personal data and files go, the journal stays valid', async () => {
      const rep = await approvedHousehold('del');
      const bystander = await approvedHousehold('stay');
      const before = db.orm.em.fork();
      const chainBefore = await before.find(
        JournalEntry,
        { product: rep.productId },
        { orderBy: { seq: 'asc' }, populate: ['supersedes'] },
      );
      expect(await verifyChain(rep.productId, chainBefore.map(toChainEntry))).toMatchObject({
        ok: true,
      });
      const document = await before.findOneOrFail(MediaAsset, rep.documentId);
      expect(await t.storage.get('private', document.originalKey)).toBeDefined();
      expect((await t.request({ method: 'GET', url: `/households/${rep.slug}` })).status).toBe(200);

      const newsItem = before.create(News, {
        slug: 'del-news',
        title: 'Household news',
        summary: 'Summary',
        body: 'Body',
        category: 'VILLAGE_EVENT',
        household: rep.householdId,
        status: 'PUBLISHED',
        publishedAt: new Date(),
      });
      await before.flush();
      const newsId = newsItem.id;

      const res = await remove(rep.auth, rep.email);
      expect(res.status).toBe(204);

      const after = db.orm.em.fork();
      // The assistant index is told to drop the household (and its products) and its news
      const queued = (await after.find(OutboxEvent, { type: 'knowledge.changed' })).map(
        (event) => event.payload,
      );
      expect(queued).toContainEqual({ sourceType: 'HOUSEHOLD', sourceId: rep.householdId });
      expect(queued).toContainEqual({ sourceType: 'NEWS', sourceId: newsId });
      expect(await after.count(News, { household: rep.householdId })).toBe(0);
      // The person
      expect(await after.findOneOrFail(AppUser, rep.id)).toMatchObject({
        status: 'DELETED',
        email: `deleted-${rep.id}@deleted.invalid`,
      });
      expect(t.authAdmin.deleted).toContain(rep.id);
      // The household is anonymized and no longer public
      const household = await after.findOneOrFail(Household, rep.householdId);
      expect(household).toMatchObject({
        name: 'Removed household',
        slug: `removed-${rep.householdId}`,
        history: '',
        status: 'SUSPENDED',
      });
      expect((await t.request({ method: 'GET', url: `/households/${rep.slug}` })).status).toBe(404);
      // Workshops and artisans are deleted
      expect(await after.count(Workshop, { household: rep.householdId })).toBe(0);
      expect(await after.count(Artisan, { household: rep.householdId })).toBe(0);
      // The identity papers are gone from the database and from storage
      expect(await after.findOne(MediaAsset, rep.documentId)).toBeNull();
      await expect(t.storage.get('private', document.originalKey)).rejects.toThrow();
      // The photo that the journal entry points to is kept, so the production record stays checkable
      expect(await after.findOne(MediaAsset, rep.photoId)).not.toBeNull();
      // The hash-chained journal is intact
      const chainAfter = await after.find(
        JournalEntry,
        { product: rep.productId },
        { orderBy: { seq: 'asc' }, populate: ['supersedes'] },
      );
      expect(chainAfter).toHaveLength(chainBefore.length);
      expect(await verifyChain(rep.productId, chainAfter.map(toChainEntry))).toMatchObject({
        ok: true,
      });
      expect(chainAfter.map((e) => e.hash)).toEqual(chainBefore.map((e) => e.hash));
      // Another household is untouched
      expect(await after.findOneOrFail(Household, bystander.householdId)).toMatchObject({
        name: 'Household stay',
        status: 'APPROVED',
      });
      expect(await after.findOne(MediaAsset, bystander.documentId)).not.toBeNull();
      expect(
        (await t.request({ method: 'GET', url: `/households/${bystander.slug}` })).status,
      ).toBe(200);
    });

    it('keeps a never-submitted DRAFT household out of the admin queue (GH#459)', async () => {
      const rep = await t.createUser('BUYER');
      const applied = await t.request({
        method: 'POST',
        url: '/me/household',
        auth: rep.auth,
        body: { name: 'Household draft', slug: 'household-draft', history: 'History draft' },
      });
      expect(applied.status).toBe(201);
      expect(applied.body.status).toBe('DRAFT');
      const workshop = await t.request({
        method: 'POST',
        url: '/me/household/workshops',
        auth: rep.auth,
        body: { name: 'Workshop draft', address: 'Draft Workshop Lane' },
      });
      expect(workshop.status).toBe(201);

      expect((await remove(rep.auth, rep.email)).status).toBe(204);

      const after = db.orm.em.fork();
      const household = await after.findOneOrFail(Household, applied.body.id);
      expect(household).toMatchObject({
        name: 'Removed household',
        slug: `removed-${household.id}`,
        history: '',
        status: 'DRAFT',
      });
      expect(await after.count(Workshop, { household: household.id })).toBe(0);
      for (const status of [undefined, 'SUSPENDED']) {
        const queue = await t.request({
          method: 'GET',
          url: status ? `/admin/households?status=${status}` : '/admin/households',
          auth: admin.auth,
        });
        expect(queue.status).toBe(200);
        expect(queue.body.data.map((h: { id: string }) => h.id)).not.toContain(household.id);
      }
    });
  });
});
