import { MikroORM } from '@mikro-orm/core';
import { Injectable } from '@nestjs/common';
import type {
  MarkAllNotificationsReadResponse,
  NotificationDto,
  NotificationListResponse,
  NotificationPreferenceDto,
  NotificationPreferencesResponse,
  UnreadCountResponse,
  UpdateNotificationPreferencesRequest,
} from '@vcraft/contracts';
import { Notification, NotificationPreference, QuotationNotice } from '@vcraft/database';
import {
  type AccountRole,
  NOTIFICATION_TYPES_BY_ROLE,
  type NotificationType,
  notificationTarget,
} from '@vcraft/domain';
import type { Actor } from '../../../common/auth/auth.guard';
import { notFound } from '../../../common/errors/app-error';

/**
 * Hộp thư in-app của người đang đăng nhập, gộp luồng báo giá (`quotation_notice`) và các thông báo
 * khác (`notification`). Mọi truy vấn lọc theo `recipientId = actor.id`: không đọc hay đánh dấu
 * được thông báo của người khác (id lạ trả 404, không phân biệt "không có" với "của người khác").
 */
@Injectable()
export class NotificationsService {
  constructor(private readonly orm: MikroORM) {}

  async list(actor: Actor, limit: number): Promise<NotificationListResponse> {
    const em = this.orm.em.fork();
    const where = { recipientId: actor.id };
    const orderBy = { createdAt: 'desc', id: 'desc' } as const;
    const [notices, others, unreadCount] = await Promise.all([
      em.find(QuotationNotice, where, { orderBy, limit }),
      em.find(Notification, where, { orderBy, limit }),
      this.unread(actor),
    ]);
    const merged = [
      ...notices.map((notice) => fromQuotationNotice(notice, actor.role)),
      ...others.map((notification) => fromNotification(notification, actor.role)),
    ]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id))
      .slice(0, limit);
    return { data: merged, unreadCount };
  }

  async unreadCount(actor: Actor): Promise<UnreadCountResponse> {
    return { unreadCount: await this.unread(actor) };
  }

  /** Idempotent: đọc lại thông báo đã đọc giữ nguyên `readAt` đầu tiên. */
  async markRead(actor: Actor, id: string): Promise<NotificationDto> {
    const em = this.orm.em.fork();
    const scope = { id, recipientId: actor.id };
    const notice = await em.findOne(QuotationNotice, scope);
    if (notice) {
      if (!notice.readAt) {
        notice.readAt = new Date();
        await em.flush();
      }
      return fromQuotationNotice(notice, actor.role);
    }
    const notification = await em.findOne(Notification, scope);
    if (!notification) throw notFound();
    if (!notification.readAt) {
      notification.readAt = new Date();
      await em.flush();
    }
    return fromNotification(notification, actor.role);
  }

  async markAllRead(actor: Actor): Promise<MarkAllNotificationsReadResponse> {
    const em = this.orm.em.fork();
    const readAt = new Date();
    const where = { recipientId: actor.id, readAt: null };
    const [fromNotices, fromOthers] = await Promise.all([
      em.nativeUpdate(QuotationNotice, where, { readAt }),
      em.nativeUpdate(Notification, where, { readAt }),
    ]);
    return { updated: fromNotices + fromOthers };
  }

  // --- Tùy chọn email (FR-NOTI-02) ---

  async preferences(actor: Actor): Promise<NotificationPreferencesResponse> {
    const stored = await this.orm.em.fork().find(NotificationPreference, { userId: actor.id });
    const overrides = new Map(stored.map((row) => [row.type, row.emailEnabled]));
    return {
      data: NOTIFICATION_TYPES_BY_ROLE[actor.role].map(
        (type): NotificationPreferenceDto => ({ type, email: overrides.get(type) ?? true }),
      ),
    };
  }

  /** Chỉ nhận các loại vai trò của người gọi có thể nhận; loại khác bị bỏ qua. */
  async updatePreferences(
    actor: Actor,
    input: UpdateNotificationPreferencesRequest,
  ): Promise<NotificationPreferencesResponse> {
    const allowed = new Set<NotificationType>(NOTIFICATION_TYPES_BY_ROLE[actor.role]);
    const wanted = new Map<NotificationType, boolean>();
    for (const item of input.preferences)
      if (allowed.has(item.type)) wanted.set(item.type, item.email);

    await this.orm.em.fork().transactional(async (em) => {
      const existing = await em.find(NotificationPreference, {
        userId: actor.id,
        type: { $in: [...wanted.keys()] },
      });
      const byType = new Map(existing.map((row) => [row.type, row]));
      for (const [type, email] of wanted) {
        const row = byType.get(type);
        if (row) row.emailEnabled = email;
        else em.create(NotificationPreference, { userId: actor.id, type, emailEnabled: email });
      }
    });
    return this.preferences(actor);
  }

  private async unread(actor: Actor): Promise<number> {
    const em = this.orm.em.fork();
    const where = { recipientId: actor.id, readAt: null };
    const [notices, others] = await Promise.all([
      em.count(QuotationNotice, where),
      em.count(Notification, where),
    ]);
    return notices + others;
  }
}

function fromQuotationNotice(notice: QuotationNotice, role: AccountRole): NotificationDto {
  return {
    id: notice.id,
    version: notice.version,
    type: notice.kind,
    target: notificationTarget(notice.kind, role, notice.requestId),
    createdAt: notice.createdAt.toISOString(),
    readAt: notice.readAt?.toISOString() ?? null,
  };
}

function fromNotification(notification: Notification, role: AccountRole): NotificationDto {
  return {
    id: notification.id,
    version: notification.version,
    type: notification.type,
    target: notificationTarget(notification.type, role, notification.subjectId),
    createdAt: notification.createdAt.toISOString(),
    readAt: notification.readAt?.toISOString() ?? null,
  };
}
