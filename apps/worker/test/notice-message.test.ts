import { NOTIFICATION_TYPES } from '@vcraft/domain';
import { describe, expect, it } from 'vitest';
import { buildNoticeMail, noticeLink } from '../src/processors/mail/notice-message';

const requestId = '0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b';
const appUrl = 'http://localhost:8080';

describe('buildNoticeMail', () => {
  it('has a distinct Vietnamese subject for every notice kind', () => {
    const subjects = NOTIFICATION_TYPES.map(
      (kind) => buildNoticeMail({ kind, role: 'BUYER', subjectId: requestId, appUrl }).subject,
    );
    expect(new Set(subjects).size).toBe(NOTIFICATION_TYPES.length);
    for (const subject of subjects) expect(subject).toMatch(/^\[vCraft\] /);
  });

  it.each([
    ['BUYER', 'yeu-cau-bao-gia'],
    ['ADMIN', 'admin/dieu-phoi'],
    ['HOUSEHOLD', 'studio/de-xuat-tham-gia'],
  ] as const)('links a %s recipient to %s', (role, path) => {
    const { text } = buildNoticeMail({
      kind: 'QUOTATION_RECEIVED',
      role,
      subjectId: requestId,
      appUrl,
    });
    expect(text).toContain(`Xem chi tiết: ${appUrl}/vi/${path}/${requestId}`);
  });

  it('is plain text without HTML', () => {
    for (const kind of NOTIFICATION_TYPES) {
      const { text } = buildNoticeMail({ kind, role: 'ADMIN', subjectId: requestId, appUrl });
      expect(text).not.toMatch(/<[a-z/][^>]*>/i);
    }
  });

  it('tolerates a trailing slash on APP_URL', () => {
    expect(noticeLink('https://vcraft.vn/', { page: 'BUYER_RFQ', id: requestId })).toBe(
      `https://vcraft.vn/vi/yeu-cau-bao-gia/${requestId}`,
    );
  });

  it('links a household decision to the application status page', () => {
    const { text } = buildNoticeMail({
      kind: 'HOUSEHOLD_APPROVED',
      role: 'HOUSEHOLD',
      subjectId: 'household-1',
      appUrl,
    });
    expect(text).toContain(`Xem chi tiết: ${appUrl}/vi/studio/ho-so`);
  });

  it('omits the link when there is no target', () => {
    const { text } = buildNoticeMail({
      kind: 'ORDER_CANCELLED',
      role: 'BUYER',
      subjectId: null,
      appUrl,
    });
    expect(text).not.toContain('Xem chi tiết');
  });
});
