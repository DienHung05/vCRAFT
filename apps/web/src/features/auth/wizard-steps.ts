import type { MeDto } from '@vcraft/contracts';

/** Bốn bước đăng ký hộ (FR-AUTH-02), theo thứ tự. */
export const WIZARD_STEPS = ['account', 'household', 'workshop', 'documents'] as const;
export type WizardStep = (typeof WIZARD_STEPS)[number];

export type WizardEntry =
  | { readonly kind: 'step'; readonly step: WizardStep }
  /** Hồ sơ đã nộp (chờ duyệt, được chấp nhận, bị từ chối, tạm ngừng): xem trạng thái ở Studio. */
  | { readonly kind: 'profile' }
  /** Tài khoản không thể đại diện hộ (quản trị viên). */
  | { readonly kind: 'blocked' };

/**
 * Wizard nối lại đúng chỗ dang dở mỗi lần mở (đóng tab giữa chừng không mất hồ sơ): suy bước hiện tại
 * từ những gì CSDL đã có, không từ bộ nhớ trình duyệt.
 * - khách → tạo tài khoản; Buyer chưa có hộ → thông tin hộ;
 * - hộ `DRAFT` (chưa nộp) chưa có xưởng → vị trí xưởng, đã có xưởng → giấy tờ.
 */
export function resolveWizardStart(
  viewer: Pick<MeDto, 'role' | 'household'> | null,
  workshopCount: number,
): WizardEntry {
  if (!viewer) return { kind: 'step', step: 'account' };
  if (viewer.role === 'ADMIN') return { kind: 'blocked' };
  if (!viewer.household) return { kind: 'step', step: 'household' };
  if (viewer.household.status !== 'DRAFT') return { kind: 'profile' };
  return { kind: 'step', step: workshopCount === 0 ? 'workshop' : 'documents' };
}
