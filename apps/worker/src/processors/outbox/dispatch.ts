import type { OutboxDispatcher } from './relay-outbox';

/** Phần của `Queue` (BullMQ) mà bộ chuyển tiếp dùng. */
export interface JobSink {
  add(name: string, data: unknown, options: { jobId: string }): Promise<unknown>;
}

/**
 * Bảng định tuyến sự kiện outbox → job. `jobId` lấy từ id nghiệp vụ nên chuyển tiếp lại (sau khi
 * worker chết giữa chừng) không sinh job trùng. Sự kiện không có ai nhận thì bỏ qua.
 */
export function createOutboxDispatcher(queues: {
  media: JobSink;
  mail: JobSink;
}): OutboxDispatcher {
  return async (event) => {
    switch (event.type) {
      case 'media.uploaded': {
        const assetId = String(event.payload.assetId);
        await queues.media.add('process', { assetId }, { jobId: `media-${assetId}` });
        return;
      }
      case 'quotation.notice': {
        const noticeIds = Array.isArray(event.payload.noticeIds) ? event.payload.noticeIds : [];
        for (const noticeId of noticeIds.map(String))
          await queues.mail.add('send', { noticeId }, { jobId: `mail-${noticeId}` });
        return;
      }
      default:
        return;
    }
  };
}
