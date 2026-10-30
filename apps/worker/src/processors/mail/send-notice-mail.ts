import type { AccountRole, QuotationNoticeKind } from '@vcraft/domain';
import { buildNoticeMail } from './notice-message';

/** Thông báo cùng người nhận, đủ để dựng thư. */
export interface NoticeRecipient {
  kind: QuotationNoticeKind;
  requestId: string;
  email: string;
  role: AccountRole;
}

/** Phần của nodemailer `Transporter` mà processor dùng; test truyền transport giả. */
export interface MailTransport {
  sendMail(message: { from: string; to: string; subject: string; text: string }): Promise<unknown>;
}

export interface MailDeps {
  loadNotice(noticeId: string): Promise<NoticeRecipient | null>;
  transport: MailTransport;
  from: string;
  appUrl: string;
}

/**
 * Job `mail`: gửi thư cho một thông báo. Không còn thông báo hay người nhận thì bỏ qua; gửi trùng
 * đã được chặn bởi `jobId` BullMQ nên không theo dõi trạng thái đã gửi. Lỗi SMTP ném ra để thử lại.
 */
export async function sendNoticeMail(deps: MailDeps, noticeId: string): Promise<boolean> {
  const notice = await deps.loadNotice(noticeId);
  if (!notice) return false;
  const { subject, text } = buildNoticeMail({ ...notice, appUrl: deps.appUrl });
  await deps.transport.sendMail({ from: deps.from, to: notice.email, subject, text });
  return true;
}
