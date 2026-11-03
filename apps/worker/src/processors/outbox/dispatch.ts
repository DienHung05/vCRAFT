import type { OutboxDispatcher } from './relay-outbox';

/** Phần của `Queue` (BullMQ) mà bộ chuyển tiếp dùng. */
export interface JobSink {
  add(name: string, data: unknown, options: { jobId: string; delay?: number }): Promise<unknown>;
}

/**
 * Bảng định tuyến sự kiện outbox → job. `jobId` lấy từ id nghiệp vụ nên chuyển tiếp lại (sau khi
 * worker chết giữa chừng) không sinh job trùng. Sự kiện không có ai nhận thì bỏ qua.
 */
export function createOutboxDispatcher(
  queues: {
    media: JobSink;
    mail: JobSink;
    qrLabels: JobSink;
    scheduler: JobSink;
    assistant: JobSink;
  },
  now: () => number = Date.now,
): OutboxDispatcher {
  return async (event) => {
    switch (event.type) {
      case 'media.uploaded': {
        const assetId = String(event.payload.assetId);
        await queues.media.add('process', { assetId }, { jobId: `media-${assetId}` });
        return;
      }
      case 'quotation.notice':
      case 'notification.created': {
        const noticeIds = Array.isArray(event.payload.noticeIds) ? event.payload.noticeIds : [];
        for (const noticeId of noticeIds.map(String))
          await queues.mail.add('send', { noticeId }, { jobId: `mail-${noticeId}` });
        return;
      }
      case 'rfq.submitted': {
        // A delayed `rfq.expire` at the bidding deadline (PLAN E9). The jobId carries the deadline, so a
        // new deadline schedules a new job; the stale one finds nothing to do.
        const requestId = String(event.payload.requestId);
        const closesAt = Date.parse(String(event.payload.biddingClosesAt));
        if (Number.isNaN(closesAt)) return;
        await queues.scheduler.add(
          'rfq.expire',
          { requestId },
          { jobId: `rfq-expire-${requestId}-${closesAt}`, delay: Math.max(0, closesAt - now()) },
        );
        return;
      }
      case 'knowledge.changed': {
        // One job per event: a later change re-indexes again (GH#79).
        await queues.assistant.add('assistant.ingest', event.payload, {
          jobId: `assistant-ingest-${event.id}`,
        });
        return;
      }
      case 'qr.labels.requested': {
        const requestId = String(event.payload.requestId);
        await queues.qrLabels.add('qr.labels', event.payload, { jobId: `qr-labels-${requestId}` });
        return;
      }
      case 'household.decision': {
        await queues.mail.add('household-decision', event.payload, {
          jobId: `mail-household-${event.id}`,
        });
        return;
      }
      default:
        return;
    }
  };
}
