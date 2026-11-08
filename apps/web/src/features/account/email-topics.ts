import type { NotificationTypeDto } from '@vcraft/contracts';

/** Nhóm hiển thị các loại thông báo trong trang tài khoản (chỉ để sắp xếp; lưu vẫn theo từng loại). */
export const EMAIL_TOPICS = ['application', 'quotation', 'order', 'news'] as const;
export type EmailTopic = (typeof EMAIL_TOPICS)[number];

const TOPIC_OF: Record<NotificationTypeDto, EmailTopic> = {
  HOUSEHOLD_APPROVED: 'application',
  HOUSEHOLD_REJECTED: 'application',
  HOUSEHOLD_INFO_REQUESTED: 'application',
  HOUSEHOLD_RESUBMITTED: 'application',
  HOUSEHOLD_SUSPENDED: 'application',
  HOUSEHOLD_REINSTATED: 'application',
  RFQ_INVITED: 'quotation',
  CONTRIBUTION_RECEIVED: 'quotation',
  QUOTATION_RECEIVED: 'quotation',
  QUOTATION_WITHDRAWN: 'quotation',
  QUOTATION_ACCEPTED: 'quotation',
  BIDDING_CLOSED: 'quotation',
  RFQ_EXPIRED: 'quotation',
  COORDINATION_NEEDED: 'quotation',
  ALLOCATION_PROPOSED: 'order',
  ALLOCATION_CONFIRMED: 'order',
  ALLOCATION_REASSIGNED: 'order',
  ORDER_CANCELLED: 'order',
  PRODUCTION_STARTED: 'order',
  PROGRESS_REPORTED: 'order',
  ORDER_RECEIVED: 'order',
  PAYMENT_PAID: 'order',
  PAYMENT_EXPIRED: 'order',
  PAYMENT_REFUNDED: 'order',
  NEWS_PUBLISHED: 'news',
};

export function topicOf(type: NotificationTypeDto): EmailTopic {
  return TOPIC_OF[type];
}
