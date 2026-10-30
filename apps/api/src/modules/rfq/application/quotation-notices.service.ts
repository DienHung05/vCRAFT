import { MikroORM } from '@mikro-orm/core';
import { Injectable } from '@nestjs/common';
import type { QuotationNoticeDto } from '@vcraft/contracts';
import { QuotationNotice } from '@vcraft/database';
import type { Actor } from '../../../common/auth/auth.guard';
import { notFound } from '../../../common/errors/app-error';

const INBOX_LIMIT = 100;

/** Hộp thư in-app của người đang đăng nhập: chỉ đọc/đánh dấu thông báo của chính mình. */
@Injectable()
export class QuotationNoticesService {
  constructor(private readonly orm: MikroORM) {}

  async list(actor: Actor): Promise<QuotationNoticeDto[]> {
    const notices = await this.orm.em
      .fork()
      .find(
        QuotationNotice,
        { recipientId: actor.id },
        { orderBy: { createdAt: 'desc', id: 'desc' }, limit: INBOX_LIMIT },
      );
    return notices.map(toDto);
  }

  /** Idempotent: đọc lại thông báo đã đọc giữ nguyên `readAt` đầu tiên. */
  async markRead(actor: Actor, id: string): Promise<QuotationNoticeDto> {
    const em = this.orm.em.fork();
    const notice = await em.findOne(QuotationNotice, { id, recipientId: actor.id });
    if (!notice) throw notFound();
    if (!notice.readAt) {
      notice.readAt = new Date();
      await em.flush();
    }
    return toDto(notice);
  }

  async markAllRead(actor: Actor): Promise<{ updated: number }> {
    const updated = await this.orm.em
      .fork()
      .nativeUpdate(
        QuotationNotice,
        { recipientId: actor.id, readAt: null },
        { readAt: new Date() },
      );
    return { updated };
  }
}

function toDto(notice: QuotationNotice): QuotationNoticeDto {
  return {
    id: notice.id,
    version: notice.version,
    kind: notice.kind,
    requestId: notice.requestId,
    quotationId: notice.quotationId ?? null,
    createdAt: notice.createdAt.toISOString(),
    readAt: notice.readAt?.toISOString() ?? null,
  };
}
