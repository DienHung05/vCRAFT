import {
  NotificationListResponseSchema,
  NotificationPreferencesResponseSchema,
  NotificationResponseSchema,
} from '@vcraft/contracts';
import { OutboxEvent, QuotationNotice } from '@vcraft/database';
import { NOTIFICATION_TYPES_BY_ROLE } from '@vcraft/domain';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startTestApp, type TestApp } from './support/test-app.js';
import { startTestDatabase, type TestDatabase } from './support/test-database.js';

/** GH#37: chuông thông báo gộp luồng báo giá và kết quả duyệt hồ sơ; quyền sở hữu và tùy chọn email. */
describe('notifications: bell inbox, ownership and email preferences', () => {
  let db: TestDatabase;
  let t: TestApp;
  let admin: { id: string; auth: string };

  beforeAll(async () => {
    db = await startTestDatabase();
    await db.migrate();
    t = await startTestApp(db);
    admin = await t.createUser('ADMIN');
  });

  afterAll(async () => {
    await t?.close();
    await db?.stop();
  });

  async function list(auth: string, query = '') {
    const res = await t.request({ method: 'GET', url: `/me/notifications${query}`, auth });
    expect(res.status).toBe(200);
    return NotificationListResponseSchema.parse(res.body);
  }

  /** Nộp hồ sơ hộ rồi để Ban quản lý quyết định; trả người đại diện và mã hộ. */
  async function applyAndDecide(action: 'approve' | 'reject', slug: string) {
    const rep = await t.createUser('BUYER');
    const applied = await t.request({
      method: 'POST',
      url: '/me/household',
      auth: rep.auth,
      body: { name: `Hộ ${slug}`, slug, history: '' },
    });
    expect(applied.status).toBe(201);
    const decided = await t.request({
      method: 'POST',
      url: `/admin/households/${applied.body.id}/${action}`,
      auth: admin.auth,
      headers: { 'if-match': String(applied.body.version) },
      body: action === 'approve' ? {} : { reason: 'Cần bổ sung giấy tờ' },
    });
    expect(decided.status).toBe(200);
    return { rep, householdId: applied.body.id as string };
  }

  it('requires a signed-in user', async () => {
    for (const url of ['/me/notifications', '/me/notifications/unread-count']) {
      expect((await t.request({ method: 'GET', url })).status).toBe(401);
    }
    expect((await t.request({ method: 'GET', url: '/me/notification-preferences' })).status).toBe(
      401,
    );
  });

  it('notifies the household representative of the decision, with a link to the application', async () => {
    const { rep, householdId } = await applyAndDecide('approve', 'noti-approve');
    const inbox = await list(rep.auth);
    expect(inbox.unreadCount).toBe(1);
    expect(inbox.data).toHaveLength(1);
    expect(inbox.data[0]).toMatchObject({
      type: 'HOUSEHOLD_APPROVED',
      target: { page: 'STUDIO_APPLICATION', id: null },
      readAt: null,
    });

    const count = await t.request({
      method: 'GET',
      url: '/me/notifications/unread-count',
      auth: rep.auth,
    });
    expect(count.body).toEqual({ unreadCount: 1 });

    // Thư cho quyết định này đi qua `household.decision` (kèm lý do); không xếp thêm thư thứ hai
    const em = db.orm.em.fork();
    expect(await em.count(OutboxEvent, { type: 'notification.created' })).toBe(0);
    expect(await em.count(OutboxEvent, { type: 'household.decision' })).toBeGreaterThan(0);

    // Người ra quyết định không tự nhận thông báo của mình
    expect((await list(admin.auth)).data.map((n) => n.type)).not.toContain('HOUSEHOLD_APPROVED');
    expect(householdId).toBeTruthy();
  });

  it('uses a distinct type for rejection and suspension', async () => {
    const rejected = await applyAndDecide('reject', 'noti-reject');
    expect((await list(rejected.rep.auth)).data[0]?.type).toBe('HOUSEHOLD_REJECTED');

    const approved = await applyAndDecide('approve', 'noti-suspend');
    const current = await t.request({
      method: 'GET',
      url: '/admin/households?status=APPROVED',
      auth: admin.auth,
    });
    const household = current.body.find((h: { id: string }) => h.id === approved.householdId);
    const suspended = await t.request({
      method: 'POST',
      url: `/admin/households/${approved.householdId}/suspend`,
      auth: admin.auth,
      headers: { 'if-match': String(household.version) },
      body: { reason: 'Tạm ngừng để kiểm tra' },
    });
    expect(suspended.status).toBe(200);
    const types = (await list(approved.rep.auth)).data.map((n) => n.type);
    expect(types).toEqual(['HOUSEHOLD_SUSPENDED', 'HOUSEHOLD_APPROVED']);
  });

  it('merges quotation notices and links each to the page of the recipient role', async () => {
    const requestId = crypto.randomUUID();
    const buyer = await t.createUser('BUYER');
    const household = await t.createUser('HOUSEHOLD');
    const em = db.orm.em.fork();
    for (const [user, kind] of [
      [buyer, 'QUOTATION_RECEIVED'],
      [household, 'ALLOCATION_PROPOSED'],
      [admin, 'CONTRIBUTION_RECEIVED'],
    ] as const) {
      em.create(QuotationNotice, { recipientId: user.id, requestId, kind });
    }
    await em.flush();

    expect((await list(buyer.auth)).data[0]?.target).toEqual({ page: 'BUYER_RFQ', id: requestId });
    expect((await list(household.auth)).data[0]?.target).toEqual({
      page: 'STUDIO_CONTRIBUTION',
      id: requestId,
    });
    const adminItem = (await list(admin.auth)).data.find((n) => n.type === 'CONTRIBUTION_RECEIVED');
    expect(adminItem?.target).toEqual({ page: 'ADMIN_COORDINATION', id: requestId });
  });

  it('orders the merged inbox newest first and honours limit', async () => {
    const rep = await t.createUser('HOUSEHOLD');
    const em = db.orm.em.fork();
    const requestId = crypto.randomUUID();
    const base = Date.now();
    ['RFQ_INVITED', 'ALLOCATION_PROPOSED', 'ORDER_CANCELLED'].forEach((kind, index) => {
      em.create(QuotationNotice, {
        recipientId: rep.id,
        requestId,
        kind: kind as 'RFQ_INVITED',
        createdAt: new Date(base + index * 1000),
      });
    });
    await em.flush();
    const inbox = await list(rep.auth, '?limit=2');
    expect(inbox.data.map((n) => n.type)).toEqual(['ORDER_CANCELLED', 'ALLOCATION_PROPOSED']);
    expect(inbox.unreadCount).toBe(3);
    const invalid = await t.request({
      method: 'GET',
      url: '/me/notifications?limit=0',
      auth: rep.auth,
    });
    expect(invalid.status).toBe(422);
  });

  describe('ownership', () => {
    it('never exposes or changes another user’s notifications', async () => {
      const { rep } = await applyAndDecide('approve', 'noti-owner');
      const stranger = await t.createUser('BUYER');
      const notificationId = (await list(rep.auth)).data[0]?.id as string;

      expect((await list(stranger.auth)).data).toEqual([]);
      expect((await list(stranger.auth)).unreadCount).toBe(0);

      const foreignRead = await t.request({
        method: 'POST',
        url: `/me/notifications/${notificationId}/read`,
        auth: stranger.auth,
      });
      expect(foreignRead.status).toBe(404);

      const foreignAll = await t.request({
        method: 'POST',
        url: '/me/notifications/read-all',
        auth: stranger.auth,
      });
      expect(foreignAll.body).toEqual({ updated: 0 });

      const stillUnread = await list(rep.auth);
      expect(stillUnread.unreadCount).toBe(1);
      expect(stillUnread.data[0]?.readAt).toBeNull();
    });

    it('does not let a user read another user’s quotation notice either', async () => {
      const owner = await t.createUser('BUYER');
      const stranger = await t.createUser('BUYER');
      const em = db.orm.em.fork();
      const notice = em.create(QuotationNotice, {
        recipientId: owner.id,
        requestId: crypto.randomUUID(),
        kind: 'QUOTATION_RECEIVED',
      });
      await em.flush();
      const res = await t.request({
        method: 'POST',
        url: `/me/notifications/${notice.id}/read`,
        auth: stranger.auth,
      });
      expect(res.status).toBe(404);
      expect((await list(owner.auth)).unreadCount).toBe(1);
    });

    it('rejects an id that is not a uuid', async () => {
      const user = await t.createUser('BUYER');
      const res = await t.request({
        method: 'POST',
        url: '/me/notifications/not-a-uuid/read',
        auth: user.auth,
      });
      expect([404, 422]).toContain(res.status);
    });
  });

  describe('mark as read', () => {
    it('marks one notification read (idempotent) and then all', async () => {
      const rep = await t.createUser('HOUSEHOLD');
      const requestId = crypto.randomUUID();
      const em = db.orm.em.fork();
      em.create(QuotationNotice, { recipientId: rep.id, requestId, kind: 'RFQ_INVITED' });
      em.create(QuotationNotice, { recipientId: rep.id, requestId, kind: 'ORDER_CANCELLED' });
      await em.flush();

      const [first] = (await list(rep.auth)).data;
      const read = await t.request({
        method: 'POST',
        url: `/me/notifications/${first?.id}/read`,
        auth: rep.auth,
      });
      expect(read.status).toBe(200);
      const dto = NotificationResponseSchema.parse(read.body);
      expect(dto.readAt).not.toBeNull();
      const again = await t.request({
        method: 'POST',
        url: `/me/notifications/${first?.id}/read`,
        auth: rep.auth,
      });
      expect(again.body.readAt).toBe(dto.readAt);
      expect((await list(rep.auth)).unreadCount).toBe(1);

      const all = await t.request({
        method: 'POST',
        url: '/me/notifications/read-all',
        auth: rep.auth,
      });
      expect(all.body).toEqual({ updated: 1 });
      expect((await list(rep.auth)).unreadCount).toBe(0);
    });

    it('marks a general notification read and counts both tables in read-all', async () => {
      const { rep } = await applyAndDecide('approve', 'noti-readall');
      const em = db.orm.em.fork();
      em.create(QuotationNotice, {
        recipientId: rep.id,
        requestId: crypto.randomUUID(),
        kind: 'RFQ_INVITED',
      });
      await em.flush();
      expect((await list(rep.auth)).unreadCount).toBe(2);
      const all = await t.request({
        method: 'POST',
        url: '/me/notifications/read-all',
        auth: rep.auth,
      });
      expect(all.body).toEqual({ updated: 2 });
    });

    it('keeps the legacy quotation-notices endpoint working', async () => {
      const buyer = await t.createUser('BUYER');
      const em = db.orm.em.fork();
      em.create(QuotationNotice, {
        recipientId: buyer.id,
        requestId: crypto.randomUUID(),
        kind: 'QUOTATION_RECEIVED',
      });
      await em.flush();
      const legacy = await t.request({
        method: 'GET',
        url: '/me/quotation-notices',
        auth: buyer.auth,
      });
      expect(legacy.status).toBe(200);
      expect(legacy.body).toHaveLength(1);
    });
  });

  describe('email preferences', () => {
    it('lists only the types of the caller’s role, all on by default', async () => {
      const buyer = await t.createUser('BUYER');
      const res = await t.request({
        method: 'GET',
        url: '/me/notification-preferences',
        auth: buyer.auth,
      });
      expect(res.status).toBe(200);
      const body = NotificationPreferencesResponseSchema.parse(res.body);
      expect(body.data.map((p) => p.type)).toEqual(NOTIFICATION_TYPES_BY_ROLE.BUYER);
      expect(body.data.every((p) => p.email)).toBe(true);
    });

    it('saves a toggle, keeps it per user, and ignores types outside the role', async () => {
      const buyer = await t.createUser('BUYER');
      const other = await t.createUser('BUYER');
      const put = await t.request({
        method: 'PUT',
        url: '/me/notification-preferences',
        auth: buyer.auth,
        body: {
          preferences: [
            { type: 'QUOTATION_RECEIVED', email: false },
            { type: 'RFQ_INVITED', email: false },
          ],
        },
      });
      expect(put.status).toBe(200);
      const saved = NotificationPreferencesResponseSchema.parse(put.body).data;
      expect(saved.find((p) => p.type === 'QUOTATION_RECEIVED')?.email).toBe(false);
      expect(saved.find((p) => p.type === 'ORDER_CANCELLED')?.email).toBe(true);
      expect(saved.some((p) => p.type === 'RFQ_INVITED')).toBe(false);

      // Lưu lại với giá trị khác cập nhật dòng cũ thay vì tạo trùng
      const again = await t.request({
        method: 'PUT',
        url: '/me/notification-preferences',
        auth: buyer.auth,
        body: { preferences: [{ type: 'QUOTATION_RECEIVED', email: true }] },
      });
      expect(
        NotificationPreferencesResponseSchema.parse(again.body).data.find(
          (p) => p.type === 'QUOTATION_RECEIVED',
        )?.email,
      ).toBe(true);

      const others = await t.request({
        method: 'GET',
        url: '/me/notification-preferences',
        auth: other.auth,
      });
      expect(others.body.data.every((p: { email: boolean }) => p.email)).toBe(true);
    });

    it('rejects an unknown type and an empty body', async () => {
      const buyer = await t.createUser('BUYER');
      for (const body of [
        { preferences: [{ type: 'NOT_A_NOTICE_TYPE', email: false }] },
        { preferences: [] },
        {},
      ]) {
        const res = await t.request({
          method: 'PUT',
          url: '/me/notification-preferences',
          auth: buyer.auth,
          body,
        });
        expect(res.status).toBe(422);
      }
    });
  });
});
