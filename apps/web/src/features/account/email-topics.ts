import type { NotificationTypeDto } from '@vcraft/contracts';

/** Nhóm hiển thị các loại thông báo trong trang tài khoản (chỉ để sắp xếp; lưu vẫn theo từng loại). */
export const EMAIL_TOPICS = ['application', 'quotation', 'order'] as const;
export type EmailTopic = (typeof EMAIL_TOPICS)[number];

const TOPIC_OF: Record<NotificationTypeDto, EmailTopic> = {
  HOUSEHOLD_APPROVED: 'application',
  HOUSEHOLD_REJECTED: 'application',
  HOUSEHOLD_INFO_REQUESTED: 'application',
  HOUSEHOLD_SUSPENDED: 'application',
  HOUSEHOLD_REINSTATED: 'application',
  RFQ_INVITED: 'quotation',
  CONTRIBUTION_RECEIVED: 'quotation',
  QUOTATION_RECEIVED: 'quotation',
  QUOTATION_WITHDRAWN: 'quotation',
  QUOTATION_ACCEPTED: 'quotation',
  ALLOCATION_PROPOSED: 'order',
  ALLOCATION_CONFIRMED: 'order',
  ORDER_CANCELLED: 'order',
  PRODUCTION_STARTED: 'order',
  PROGRESS_REPORTED: 'order',
  ORDER_RECEIVED: 'order',
};

export function topicOf(type: NotificationTypeDto): EmailTopic {
  return TOPIC_OF[type];
}
