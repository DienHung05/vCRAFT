/**
 * Hàng đợi BullMQ: chuyển đổi ảnh, gửi mail, chuyển tiếp outbox (bản phát hành đầu, vCRAFT-83g) và
 * dựng tờ nhãn QR PDF (`qr.labels`, PLAN E6).
 */
export const MEDIA_QUEUE = 'media';
export const MAIL_QUEUE = 'mail';
export const OUTBOX_QUEUE = 'outbox';
export const QR_LABELS_QUEUE = 'qr-labels';

/** Nhịp chuyển tiếp outbox: client hỏi lại mỗi 10–15s nên 2s là đủ nhanh. */
export const OUTBOX_RELAY_EVERY_MS = 2_000;

export interface MediaJob {
  assetId: string;
}

export interface MailJob {
  noticeId: string;
}
