import type { MeDto } from '@vcraft/contracts';
import { describe, expect, it, vi } from 'vitest';
import { precheckDocument } from '@/features/auth/document-upload';
import {
  householdStepSchema,
  registerSchema,
  setPasswordSchema,
  signInSchema,
  workshopStepSchema,
} from '@/features/auth/schemas';
import { resolveWizardStart } from '@/features/auth/wizard-steps';

// `next-intl/navigation` cần runtime Next; `document-upload` chỉ dùng `getPathname`.
vi.mock('@/i18n/navigation', () => ({ getPathname: ({ href }: { href: string }) => href }));

const household = (status: NonNullable<MeDto['household']>['status']): MeDto['household'] => ({
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Gốm Bảo Châu',
  slug: 'gom-bao-chau',
  status,
  statusReason: null,
});

describe('resolveWizardStart: nối lại đúng bước dang dở (FR-AUTH-02)', () => {
  it('khách bắt đầu từ tạo tài khoản', () => {
    expect(resolveWizardStart(null, 0)).toEqual({ kind: 'step', step: 'account' });
  });

  it('Buyer chưa có hộ sang thông tin hộ', () => {
    expect(resolveWizardStart({ role: 'BUYER', household: null }, 0)).toEqual({
      kind: 'step',
      step: 'household',
    });
  });

  it('hộ chờ duyệt chưa có xưởng sang vị trí xưởng, đã có xưởng sang giấy tờ', () => {
    const viewer = { role: 'HOUSEHOLD', household: household('PENDING_REVIEW') } as const;
    expect(resolveWizardStart(viewer, 0)).toEqual({ kind: 'step', step: 'workshop' });
    expect(resolveWizardStart(viewer, 2)).toEqual({ kind: 'step', step: 'documents' });
  });

  it('hồ sơ đã được xử lý thì xem trạng thái thay vì đăng ký lại', () => {
    for (const status of ['APPROVED', 'REJECTED', 'SUSPENDED'] as const) {
      expect(resolveWizardStart({ role: 'HOUSEHOLD', household: household(status) }, 1)).toEqual({
        kind: 'profile',
      });
    }
  });

  it('quản trị viên không đăng ký hộ được', () => {
    expect(resolveWizardStart({ role: 'ADMIN', household: null }, 0)).toEqual({ kind: 'blocked' });
  });
});

const messageOf = (result: { success: boolean; error?: { issues: { message: string }[] } }) =>
  result.error?.issues.map((issue) => issue.message);

describe('luật kiểm tra form tài khoản (khóa i18n, không phải câu chữ)', () => {
  it('email bắt buộc và đúng dạng', () => {
    expect(messageOf(signInSchema.safeParse({ email: '', password: 'x' }))).toContain(
      'emailRequired',
    );
    expect(
      messageOf(signInSchema.safeParse({ email: 'khong-phai-email', password: 'x' })),
    ).toContain('emailInvalid');
  });

  it('đăng nhập không áp luật độ mạnh: mật khẩu cũ ngắn vẫn nhập được', () => {
    expect(signInSchema.safeParse({ email: 'a@b.vn', password: '123' }).success).toBe(true);
  });

  it('đăng ký: tối thiểu 8 ký tự và có cả chữ lẫn số', () => {
    expect(messageOf(registerSchema.safeParse({ email: 'a@b.vn', password: 'abc1' }))).toContain(
      'passwordShort',
    );
    expect(
      messageOf(registerSchema.safeParse({ email: 'a@b.vn', password: 'chiToanChu' })),
    ).toContain('passwordWeak');
    expect(
      messageOf(registerSchema.safeParse({ email: 'a@b.vn', password: '1234567890' })),
    ).toContain('passwordWeak');
    expect(registerSchema.safeParse({ email: 'a@b.vn', password: 'matkhau2026' }).success).toBe(
      true,
    );
  });

  it('đặt mật khẩu: hai ô phải khớp', () => {
    const result = setPasswordSchema.safeParse({ password: 'matkhau2026', confirm: 'matkhau2027' });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]).toMatchObject({
      path: ['confirm'],
      message: 'confirmMismatch',
    });
  });

  it('thông tin hộ: tên ≥ 2 ký tự, đường dẫn chữ thường không dấu', () => {
    const base = { name: 'Gốm Minh Hải', slug: 'gom-minh-hai', village: '', history: '' };
    expect(householdStepSchema.safeParse(base).success).toBe(true);
    expect(messageOf(householdStepSchema.safeParse({ ...base, name: 'A' }))).toContain('nameShort');
    expect(messageOf(householdStepSchema.safeParse({ ...base, slug: 'Gốm Minh Hải' }))).toContain(
      'slugInvalid',
    );
    expect(messageOf(householdStepSchema.safeParse({ ...base, slug: '' }))).toContain(
      'slugRequired',
    );
  });

  it('xưởng: bắt buộc chọn vị trí trên bản đồ, tọa độ trong khoảng hợp lệ', () => {
    const base = {
      name: 'Lò Minh Hải',
      address: 'Xóm 3, Bát Tràng',
      purpose: 'BOTH',
      acceptsVisitors: true,
      visitingInfo: '',
    };
    expect(messageOf(workshopStepSchema.safeParse(base))).toContain('locationRequired');
    expect(workshopStepSchema.safeParse({ ...base, lat: 20.9758, lng: 105.9139 }).success).toBe(
      true,
    );
    expect(messageOf(workshopStepSchema.safeParse({ ...base, lat: 91, lng: 105 }))).toContain(
      'latInvalid',
    );
    expect(messageOf(workshopStepSchema.safeParse({ ...base, lat: 20, lng: 181 }))).toContain(
      'lngInvalid',
    );
  });
});

describe('precheckDocument (giấy tờ xác minh)', () => {
  it('nhận ảnh và PDF trong giới hạn 10 MB', () => {
    expect(precheckDocument({ type: 'application/pdf', size: 1024 })).toBeNull();
    expect(precheckDocument({ type: 'image/jpeg', size: 10 * 1024 * 1024 })).toBeNull();
  });

  it('từ chối loại lạ và tệp quá lớn bằng thông điệp cụ thể', () => {
    expect(precheckDocument({ type: 'image/svg+xml', size: 10 })).toBe('mediaUnsupported');
    expect(precheckDocument({ type: 'application/zip', size: 10 })).toBe('mediaUnsupported');
    expect(precheckDocument({ type: 'image/png', size: 10 * 1024 * 1024 + 1 })).toBe(
      'mediaTooLarge',
    );
  });
});
