import type { EntityManager } from '@mikro-orm/core';
import { Injectable } from '@nestjs/common';
import { Household, OutboxEvent, QuotationNotice } from '@vcraft/database';
import { noticeRecipients, type QuotationNoticeKind } from '@vcraft/domain';

/** Sự kiện outbox mà worker đổi thành một thư SMTP cho mỗi thông báo. */
export const QUOTATION_NOTICE_EVENT = 'quotation.notice';

export interface QuotationNoticeInput {
  kind: QuotationNoticeKind;
  requestId: string;
  quotationId?: string | null;
  /** Người gây ra sự kiện; không tự nhận thông báo của chính mình. */
  actorId: string;
  recipientIds: ReadonlyArray<string | null | undefined>;
}

/**
 * Ghi thông báo in-app và sự kiện outbox cho thư SMTP (GH#13). Chạy trong giao dịch của người gọi
 * nên thông báo chỉ tồn tại khi thay đổi nghiệp vụ được commit.
 */
@Injectable()
export class QuotationNotifier {
  async notify(em: EntityManager, input: QuotationNoticeInput): Promise<string[]> {
    const recipients = noticeRecipients(input.recipientIds, input.actorId);
    if (recipients.length === 0) return [];
    const notices = recipients.map((recipientId) =>
      em.create(QuotationNotice, {
        recipientId,
        requestId: input.requestId,
        quotationId: input.quotationId ?? null,
        kind: input.kind,
      }),
    );
    const noticeIds = notices.map((notice) => notice.id);
    em.create(OutboxEvent, { type: QUOTATION_NOTICE_EVENT, payload: { noticeIds } });
    return noticeIds;
  }

  /** Tài khoản đại diện của các hộ (thông báo gửi cho người, không gửi cho hộ). */
  async representativeIds(em: EntityManager, householdIds: readonly string[]): Promise<string[]> {
    if (householdIds.length === 0) return [];
    const households = await em.find(
      Household,
      { id: { $in: [...new Set(householdIds)] } },
      { populate: ['representative'] },
    );
    return households.map((household) => household.representative.id);
  }
}
