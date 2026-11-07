import type { MeDto } from '@vcraft/contracts';
import { describe, expect, it } from 'vitest';
import {
  AREA_ROLE,
  type Area,
  decideAccess,
  landingPath,
  landingPathFor,
  workspacePath,
} from '@/lib/auth/access';
import {
  hasHouseholdIntent,
  hasUnfinishedHouseholdRegistration,
} from '@/lib/auth/household-intent';
import { localeOfPath, safeReturnTo } from '@/lib/auth/return-to';

type Viewer = Pick<MeDto, 'role' | 'status' | 'household'>;

const household = (status: NonNullable<MeDto['household']>['status']): MeDto['household'] => ({
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Gốm Minh Hải',
  slug: 'gom-minh-hai',
  status,
  statusReason: null,
});

const buyer: Viewer = { role: 'BUYER', status: 'ACTIVE', household: null };
const admin: Viewer = { role: 'ADMIN', status: 'ACTIVE', household: null };
const approved: Viewer = { role: 'HOUSEHOLD', status: 'ACTIVE', household: household('APPROVED') };
const pending: Viewer = {
  role: 'HOUSEHOLD',
  status: 'ACTIVE',
  household: household('PENDING_REVIEW'),
};

describe('decideAccess (FR-AUTH-09)', () => {
  it('khách vào bất kỳ khu vực nào cũng bị chuyển tới đăng nhập', () => {
    for (const area of ['buyer', 'studio', 'admin'] as Area[]) {
      expect(decideAccess(null, area)).toEqual({ kind: 'sign-in' });
    }
  });

  it('mỗi vai trò chỉ vào khu của mình, vai trò khác nhận 403', () => {
    expect(decideAccess(buyer, 'buyer')).toEqual({ kind: 'allow' });
    expect(decideAccess(admin, 'admin')).toEqual({ kind: 'allow' });
    expect(decideAccess(approved, 'studio')).toEqual({ kind: 'allow' });
    expect(decideAccess(buyer, 'admin')).toEqual({ kind: 'forbidden', reason: 'role' });
    expect(decideAccess(buyer, 'studio')).toEqual({ kind: 'forbidden', reason: 'role' });
    expect(decideAccess(admin, 'buyer')).toEqual({ kind: 'forbidden', reason: 'role' });
    expect(decideAccess(approved, 'admin')).toEqual({ kind: 'forbidden', reason: 'role' });
    expect(decideAccess(approved, 'buyer')).toEqual({ kind: 'forbidden', reason: 'role' });
  });

  it('tài khoản bị khóa bị chặn ở mọi khu vực, kể cả khu của chính vai trò', () => {
    const locked: Viewer = { ...admin, status: 'LOCKED' };
    expect(decideAccess(locked, 'admin')).toEqual({ kind: 'forbidden', reason: 'locked' });
    expect(decideAccess({ ...approved, status: 'LOCKED' }, 'studio')).toEqual({
      kind: 'forbidden',
      reason: 'locked',
    });
  });

  it('hộ chờ duyệt chỉ được xem trang trạng thái hồ sơ', () => {
    expect(decideAccess(pending, 'studio')).toEqual({ kind: 'household-profile' });
    expect(decideAccess(pending, 'studio', { onHouseholdProfile: true })).toEqual({
      kind: 'allow',
    });
  });

  it('hộ bị từ chối cũng chỉ xem trạng thái; hộ tạm ngừng vẫn đọc được bản ghi riêng', () => {
    const rejected: Viewer = { ...pending, household: household('REJECTED') };
    const suspended: Viewer = { ...pending, household: household('SUSPENDED') };
    expect(decideAccess(rejected, 'studio')).toEqual({ kind: 'household-profile' });
    expect(decideAccess(suspended, 'studio')).toEqual({ kind: 'allow' });
  });

  it('vai trò hộ nhưng chưa có hồ sơ thì đưa về trang hồ sơ, không vào Studio', () => {
    const orphan: Viewer = { role: 'HOUSEHOLD', status: 'ACTIVE', household: null };
    expect(decideAccess(orphan, 'studio')).toEqual({ kind: 'household-profile' });
  });

  it('bảng vai trò theo khu khớp thuật ngữ GLOSSARY', () => {
    expect(AREA_ROLE).toEqual({ buyer: 'BUYER', studio: 'HOUSEHOLD', admin: 'ADMIN' });
  });
});

describe('đích sau đăng nhập theo vai trò', () => {
  it('Buyer về trang chủ, hộ vào hồ sơ hộ, Admin vào /admin', () => {
    expect(landingPath('BUYER')).toBe('/');
    expect(landingPath('HOUSEHOLD')).toBe('/studio/ho-so');
    expect(landingPath('ADMIN')).toBe('/admin');
  });

  it('menu tài khoản trỏ Buyer tới khu yêu cầu báo giá', () => {
    expect(workspacePath('BUYER')).toBe('/yeu-cau-bao-gia');
  });
});

describe('unfinished household registration (GH#180)', () => {
  const pending = {
    id: 'h1',
    name: 'Hộ A',
    slug: 'ho-a',
    status: 'PENDING_REVIEW' as const,
    statusReason: null,
  };

  it('reads the flag only when it is exactly true', () => {
    expect(hasHouseholdIntent({ household_intent: true })).toBe(true);
    expect(hasHouseholdIntent({ household_intent: 'true' })).toBe(false);
    expect(hasHouseholdIntent({})).toBe(false);
    expect(hasHouseholdIntent(null)).toBe(false);
    expect(hasHouseholdIntent(undefined)).toBe(false);
  });

  it('a Buyer with the flag and no household has an unfinished registration', () => {
    expect(hasUnfinishedHouseholdRegistration({ role: 'BUYER', household: null }, true)).toBe(true);
    expect(hasUnfinishedHouseholdRegistration({ role: 'BUYER', household: null }, false)).toBe(
      false,
    );
    expect(
      hasUnfinishedHouseholdRegistration({ role: 'HOUSEHOLD', household: pending }, true),
    ).toBe(false);
    expect(hasUnfinishedHouseholdRegistration({ role: 'ADMIN', household: null }, true)).toBe(
      false,
    );
    expect(hasUnfinishedHouseholdRegistration(null, true)).toBe(false);
  });

  it('sign-in sends that Buyer back to the wizard, everyone else to the role landing', () => {
    expect(landingPathFor({ role: 'BUYER', household: null }, true)).toBe('/dang-ky-nghe-nhan');
    expect(landingPathFor({ role: 'BUYER', household: null }, false)).toBe('/');
    expect(landingPathFor({ role: 'HOUSEHOLD', household: pending }, true)).toBe('/studio/ho-so');
    expect(landingPathFor({ role: 'ADMIN', household: null }, true)).toBe('/admin');
  });
});

describe('safeReturnTo (chống open redirect)', () => {
  it('nhận đường dẫn nội bộ có tiền tố ngôn ngữ, giữ nguyên query', () => {
    expect(safeReturnTo('/vi/yeu-cau-bao-gia/abc?tab=2')).toBe('/vi/yeu-cau-bao-gia/abc?tab=2');
    expect(safeReturnTo('/en/quotes')).toBe('/en/quotes');
    expect(safeReturnTo('/vi')).toBe('/vi');
  });

  it.each([
    ['https://evil.test/vi', 'URL tuyệt đối'],
    ['//evil.test/vi/x', 'protocol-relative'],
    ['/\\evil.test', 'dấu gạch ngược'],
    ['/vi/x\nSet-Cookie: a=b', 'ký tự điều khiển'],
    ['/dang-nhap', 'thiếu tiền tố ngôn ngữ'],
    ['/vietnam', 'tiền tố giống nhưng không phải ngôn ngữ'],
    ['javascript:alert(1)', 'scheme javascript'],
    ['', 'rỗng'],
  ])('từ chối %s (%s)', (raw) => {
    expect(safeReturnTo(raw)).toBeNull();
  });

  it('từ chối giá trị rỗng, thiếu hoặc quá dài', () => {
    expect(safeReturnTo(undefined)).toBeNull();
    expect(safeReturnTo(null)).toBeNull();
    expect(safeReturnTo(`/vi/${'a'.repeat(600)}`)).toBeNull();
  });

  it('localeOfPath đọc ngôn ngữ từ đường dẫn', () => {
    expect(localeOfPath('/en/quotes?x=1')).toBe('en');
    expect(localeOfPath('/vi')).toBe('vi');
    expect(localeOfPath('/fr/x')).toBeNull();
    expect(localeOfPath(null)).toBeNull();
  });
});
