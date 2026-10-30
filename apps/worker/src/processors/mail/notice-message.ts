import type { AccountRole, QuotationNoticeKind } from '@vcraft/domain';

export interface NoticeMail {
  subject: string;
  text: string;
}

/** Nội dung từng loại thông báo: tiêu đề thư và một câu mô tả sự kiện. */
const COPY: Record<QuotationNoticeKind, { subject: string; body: string }> = {
  RFQ_INVITED: {
    subject: 'Bạn được mời tham gia một yêu cầu báo giá',
    body: 'Một yêu cầu báo giá mới đang chờ đề xuất tham gia của hộ bạn.',
  },
  CONTRIBUTION_RECEIVED: {
    subject: 'Có đề xuất tham gia mới',
    body: 'Một hộ vừa gửi hoặc cập nhật đề xuất tham gia cho yêu cầu báo giá bạn điều phối.',
  },
  QUOTATION_RECEIVED: {
    subject: 'Bạn nhận được chào giá mới',
    body: 'Yêu cầu báo giá của bạn vừa có một chào giá hợp tác xã mới để xem xét.',
  },
  QUOTATION_WITHDRAWN: {
    subject: 'Một chào giá đã mất hiệu lực',
    body: 'Một hộ đã thay đổi hoặc rút đề xuất nên chào giá liên quan không còn hiệu lực.',
  },
  QUOTATION_ACCEPTED: {
    subject: 'Chào giá đã được chấp nhận',
    body: 'Người mua đã chốt chào giá; các hộ có phần sẽ được đề nghị xác nhận phân bổ.',
  },
  ALLOCATION_PROPOSED: {
    subject: 'Bạn có phần sản xuất cần xác nhận',
    body: 'Người mua đã chốt chào giá có phần của hộ bạn. Vui lòng xác nhận hoặc từ chối phân bổ.',
  },
  ALLOCATION_CONFIRMED: {
    subject: 'Một hộ đã xác nhận phân bổ',
    body: 'Một hộ vừa xác nhận phần sản xuất của mình trong đơn hàng.',
  },
  ORDER_CANCELLED: {
    subject: 'Đơn hàng đã bị hủy',
    body: 'Đơn hàng đã bị hủy; các phân bổ còn hiệu lực không được tiếp tục.',
  },
  PRODUCTION_STARTED: {
    subject: 'Đơn hàng đã bắt đầu sản xuất',
    body: 'Đơn hàng đã chuyển sang giai đoạn sản xuất.',
  },
  PROGRESS_REPORTED: {
    subject: 'Có cập nhật tiến độ sản xuất',
    body: 'Một hộ vừa báo cáo tiến độ sản xuất cho đơn hàng.',
  },
  ORDER_RECEIVED: {
    subject: 'Đơn hàng đã được xác nhận nhận hàng',
    body: 'Đơn hàng đã được xác nhận nhận hàng. Cảm ơn bạn đã tham gia.',
  },
};

/** Trang chi tiết yêu cầu báo giá theo vai trò người nhận (không có dấu `/` đầu và cuối). */
const ROLE_PATH: Record<AccountRole, string> = {
  BUYER: 'yeu-cau-bao-gia',
  ADMIN: 'admin/dieu-phoi',
  HOUSEHOLD: 'studio/de-xuat-tham-gia',
};

export function noticeLink(appUrl: string, role: AccountRole, requestId: string): string {
  return `${appUrl.replace(/\/+$/, '')}/vi/${ROLE_PATH[role]}/${requestId}`;
}

/** Thư văn bản thuần (không HTML) cho một thông báo; hàm thuần nên kiểm thử không cần SMTP. */
export function buildNoticeMail(input: {
  kind: QuotationNoticeKind;
  role: AccountRole;
  requestId: string;
  appUrl: string;
}): NoticeMail {
  const copy = COPY[input.kind];
  return {
    subject: `[vCraft] ${copy.subject}`,
    text: [
      'Xin chào,',
      '',
      copy.body,
      '',
      `Xem chi tiết: ${noticeLink(input.appUrl, input.role, input.requestId)}`,
      '',
      'vCraft',
    ].join('\n'),
  };
}
