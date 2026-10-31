import type { AccountRole, NotificationType } from '@vcraft/domain';
import { buildNoticeMail } from './notice-message';

/** Thông báo cùng người nhận, đủ để dựng thư. */
export interface NoticeRecipient {
  kind: NotificationType;
  /** Mã yêu cầu báo giá hoặc đối tượng liên quan, nếu có. */
  subjectId: string | null;
  email: string;
  role: AccountRole;
  /** Người nhận đã tắt email cho loại này (FR-NOTI-02): thông báo in-app vẫn còn, thư thì không gửi. */
  emailEnabled: boolean;
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
 * Job `mail`: gửi thư cho một thông báo. Không còn thông báo hay người nhận, hoặc người nhận đã tắt
 * email cho loại này, thì bỏ qua; gửi trùng đã được chặn bởi `jobId` BullMQ nên không theo dõi trạng
 * thái đã gửi. Lỗi SMTP ném ra để thử lại.
 */
export async function sendNoticeMail(deps: MailDeps, noticeId: string): Promise<boolean> {
  const notice = await deps.loadNotice(noticeId);
  if (!notice?.emailEnabled) return false;
  const { subject, text } = buildNoticeMail({ ...notice, appUrl: deps.appUrl });
  await deps.transport.sendMail({ from: deps.from, to: notice.email, subject, text });
  return true;
}
