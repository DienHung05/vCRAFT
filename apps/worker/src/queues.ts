/**
 * Ba hàng đợi BullMQ của bản phát hành đầu (vCRAFT-83g): chuyển đổi ảnh, gửi mail, chuyển tiếp outbox.
 * Không có SSE, QR PDF hay job hẹn giờ khác.
 */
export const MEDIA_QUEUE = 'media';
export const MAIL_QUEUE = 'mail';
export const OUTBOX_QUEUE = 'outbox';

/** Nhịp chuyển tiếp outbox: client hỏi lại mỗi 10–15s nên 2s là đủ nhanh. */
export const OUTBOX_RELAY_EVERY_MS = 2_000;

export interface MediaJob {
  assetId: string;
}

export interface MailJob {
  noticeId: string;
}
