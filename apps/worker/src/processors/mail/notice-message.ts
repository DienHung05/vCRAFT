import {
  type AccountRole,
  type NotificationTarget,
  type NotificationTargetPage,
  type NotificationType,
  notificationTarget,
} from '@vcraft/domain';

export interface NoticeMail {
  subject: string;
  text: string;
}

/** Nội dung từng loại thông báo: tiêu đề thư và một câu mô tả sự kiện. */
const COPY: Record<NotificationType, { subject: string; body: string }> = {
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
  HOUSEHOLD_APPROVED: {
    subject: 'Hồ sơ hộ của bạn đã được chấp nhận',
    body: 'Ban quản lý đã chấp nhận hộ của bạn. Trang của hộ nay hiện công khai và Studio đã mở.',
  },
  HOUSEHOLD_REJECTED: {
    subject: 'Hồ sơ hộ của bạn chưa được chấp nhận',
    body: 'Ban quản lý chưa chấp nhận hồ sơ hộ của bạn. Xem lý do trong trang trạng thái hồ sơ.',
  },
  HOUSEHOLD_INFO_REQUESTED: {
    subject: 'Hồ sơ hộ của bạn cần bổ sung thông tin',
    body: 'Ban quản lý cần thêm thông tin để xét hồ sơ hộ của bạn. Xem yêu cầu trong trang trạng thái hồ sơ.',
  },
  HOUSEHOLD_SUSPENDED: {
    subject: 'Hộ của bạn tạm ngừng trưng bày',
    body: 'Ban quản lý đã tạm ngừng trưng bày hộ của bạn. Xem lý do trong trang trạng thái hồ sơ.',
  },
  HOUSEHOLD_REINSTATED: {
    subject: 'Hộ của bạn được trưng bày trở lại',
    body: 'Ban quản lý đã khôi phục trưng bày cho hộ của bạn.',
  },
  NEWS_PUBLISHED: {
    subject: 'Ban quản lý vừa đăng một tin quan trọng',
    body: 'Ban quản lý làng nghề vừa đăng một tin quan trọng dành cho các hộ.',
  },
};

/** Đường dẫn tiếng Việt của từng trang đích (không có dấu `/` đầu); `{id}` là mã đối tượng. */
const PAGE_PATH: Record<NotificationTargetPage, string> = {
  BUYER_RFQ: 'yeu-cau-bao-gia/{id}',
  STUDIO_CONTRIBUTION: 'studio/de-xuat-tham-gia/{id}',
  ADMIN_COORDINATION: 'admin/dieu-phoi/{id}',
  STUDIO_APPLICATION: 'studio/ho-so',
  NEWS_ARTICLE: 'tin-tuc/{id}',
};

export function noticeLink(appUrl: string, target: NotificationTarget): string {
  const path = PAGE_PATH[target.page].replace('{id}', target.id ?? '');
  return `${appUrl.replace(/\/+$/, '')}/vi/${path}`;
}

/** Thư văn bản thuần (không HTML) cho một thông báo; hàm thuần nên kiểm thử không cần SMTP. */
export function buildNoticeMail(input: {
  kind: NotificationType;
  role: AccountRole;
  /** Mã yêu cầu báo giá (luồng báo giá) hoặc đối tượng liên quan; có thể không có. */
  subjectId: string | null;
  appUrl: string;
}): NoticeMail {
  const copy = COPY[input.kind];
  const target = notificationTarget(input.kind, input.role, input.subjectId);
  return {
    subject: `[vCraft] ${copy.subject}`,
    text: [
      'Xin chào,',
      '',
      copy.body,
      '',
      ...(target ? [`Xem chi tiết: ${noticeLink(input.appUrl, target)}`, ''] : []),
      'vCraft',
    ].join('\n'),
  };
}
