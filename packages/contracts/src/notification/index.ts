import { NOTIFICATION_TARGET_PAGES, NOTIFICATION_TYPES } from '@vcraft/domain';
import { z } from 'zod';
import { IdSchema, IsoDateTimeSchema, MAX_PAGE_LIMIT, VersionSchema } from '../common';

/**
 * Thông báo in-app của mọi vai trò (GH#37, FR-NOTI-01…03): `GET /me/notifications`, đánh dấu đã đọc,
 * và tùy chọn nhận email theo loại. Không có SSE: client hỏi lại theo chu kỳ (GH#13).
 */

export const NotificationTypeSchema = z.enum(NOTIFICATION_TYPES);
export type NotificationTypeDto = z.infer<typeof NotificationTypeSchema>;

/** Trang một thông báo dẫn tới; web đổi sang đường dẫn theo ngôn ngữ đang xem. */
export const NotificationTargetSchema = z.strictObject({
  page: z.enum(NOTIFICATION_TARGET_PAGES),
  id: IdSchema.nullable(),
});
export type NotificationTargetDto = z.infer<typeof NotificationTargetSchema>;

export const NotificationResponseSchema = z.strictObject({
  id: IdSchema,
  version: VersionSchema,
  type: NotificationTypeSchema,
  target: NotificationTargetSchema.nullable(),
  createdAt: IsoDateTimeSchema,
  readAt: IsoDateTimeSchema.nullable(),
});
export type NotificationDto = z.infer<typeof NotificationResponseSchema>;

/** `?limit=` số thông báo mới nhất cần lấy (mặc định 30). */
export const ListNotificationsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_LIMIT).default(30),
});
export type ListNotificationsQuery = z.infer<typeof ListNotificationsQuerySchema>;

export const NotificationListResponseSchema = z.strictObject({
  data: z.array(NotificationResponseSchema),
  /** Tổng số chưa đọc, kể cả ngoài `limit` mới nhất. */
  unreadCount: z.int().min(0),
});
export type NotificationListResponse = z.infer<typeof NotificationListResponseSchema>;

export const UnreadCountResponseSchema = z.strictObject({ unreadCount: z.int().min(0) });
export type UnreadCountResponse = z.infer<typeof UnreadCountResponseSchema>;

export const MarkAllNotificationsReadResponseSchema = z.strictObject({ updated: z.int().min(0) });
export type MarkAllNotificationsReadResponse = z.infer<
  typeof MarkAllNotificationsReadResponseSchema
>;

/** Một tùy chọn email: loại thông báo có được gửi thư hay không (mặc định bật). */
export const NotificationPreferenceSchema = z.strictObject({
  type: NotificationTypeSchema,
  email: z.boolean(),
});
export type NotificationPreferenceDto = z.infer<typeof NotificationPreferenceSchema>;

/** Chỉ gồm các loại mà vai trò của người gọi có thể nhận. */
export const NotificationPreferencesResponseSchema = z.strictObject({
  data: z.array(NotificationPreferenceSchema),
});
export type NotificationPreferencesResponse = z.infer<typeof NotificationPreferencesResponseSchema>;

export const UpdateNotificationPreferencesRequestSchema = z.strictObject({
  preferences: z.array(NotificationPreferenceSchema).min(1).max(NOTIFICATION_TYPES.length),
});
export type UpdateNotificationPreferencesRequest = z.infer<
  typeof UpdateNotificationPreferencesRequestSchema
>;

/**
 * `GET /me/events`: Server-Sent Events for the bell and live quotation screens (GH#93, ADR-07). Each
 * `data:` line is one `LiveEvent`. `notifications` carries the new unread count; `activity` says a notice
 * concerning the account arrived, so open live views should refetch. Clients keep polling as a fallback.
 */
export const LiveEventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('ready'), retryMs: z.int().positive() }),
  z.object({ type: z.literal('notifications'), unreadCount: z.int().min(0) }),
  z.object({ type: z.literal('activity'), at: z.string() }),
]);
export type LiveEvent = z.infer<typeof LiveEventSchema>;
