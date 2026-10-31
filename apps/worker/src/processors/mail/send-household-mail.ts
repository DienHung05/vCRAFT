import type { MikroORM } from '@mikro-orm/core';
import { AppUser, Household, NotificationPreference } from '@vcraft/database';
import { householdNoticeKind } from '@vcraft/domain';
import type { MailTransport } from './send-notice-mail';

export type HouseholdDecision = 'APPROVE' | 'REJECT' | 'REQUEST_INFO' | 'SUSPEND' | 'REINSTATE';

const COPY: Record<HouseholdDecision, { subject: string; body: string }> = {
  APPROVE: {
    subject: 'Hồ sơ hộ của bạn đã được duyệt',
    body: 'Ban quản lý làng đã duyệt hộ {name}. Bạn có thể vào Studio để xuất bản sản phẩm.',
  },
  REJECT: {
    subject: 'Hồ sơ hộ của bạn chưa được chấp nhận',
    body: 'Ban quản lý làng chưa chấp nhận hồ sơ của hộ {name}.',
  },
  REQUEST_INFO: {
    subject: 'Hồ sơ hộ của bạn cần bổ sung thông tin',
    body: 'Ban quản lý làng cần thêm thông tin để xét hồ sơ của hộ {name}.',
  },
  SUSPEND: {
    subject: 'Hộ của bạn đang bị tạm khóa',
    body: 'Ban quản lý làng đã tạm khóa hộ {name}. Sản phẩm của hộ không còn hiện công khai.',
  },
  REINSTATE: {
    subject: 'Hộ của bạn đã được mở khóa',
    body: 'Ban quản lý làng đã mở khóa hộ {name}. Sản phẩm đã xuất bản hiện công khai trở lại.',
  },
};

export interface HouseholdMailInput {
  decision: HouseholdDecision;
  householdName: string;
  reason: string | null;
  appUrl: string;
}

export function buildHouseholdMail({
  decision,
  householdName,
  reason,
  appUrl,
}: HouseholdMailInput) {
  const copy = COPY[decision];
  const lines = [
    copy.body.replace('{name}', householdName),
    ...(reason ? [`Lý do: ${reason}`] : []),
    `Xem chi tiết: ${appUrl.replace(/\/+$/, '')}/vi/studio/ho-so`,
  ];
  return { subject: copy.subject, text: lines.join('\n\n') };
}

export interface HouseholdMailJob {
  householdId: string;
  decision: HouseholdDecision;
  reason: string | null;
}

/**
 * Job `household-decision`: báo quyết định cho người đại diện; hộ đã mất thì bỏ qua, người đại diện
 * đã tắt email cho loại này (FR-NOTI-02) cũng bỏ qua.
 */
export async function sendHouseholdMail(
  deps: { orm: MikroORM; transport: MailTransport; from: string; appUrl: string },
  job: HouseholdMailJob,
): Promise<boolean> {
  const em = deps.orm.em.fork();
  const household = await em.findOne(Household, job.householdId);
  if (!household) return false;
  const user = await em.findOne(AppUser, household.representative.id);
  if (!user) return false;
  const preference = await em.findOne(NotificationPreference, {
    userId: user.id,
    type: householdNoticeKind(job.decision),
  });
  if (preference && !preference.emailEnabled) return false;
  const { subject, text } = buildHouseholdMail({
    decision: job.decision,
    householdName: household.name,
    reason: job.reason,
    appUrl: deps.appUrl,
  });
  await deps.transport.sendMail({ from: deps.from, to: user.email, subject, text });
  return true;
}
