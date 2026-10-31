// @vitest-environment node
import type { MeDto } from '@vcraft/contracts';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/** Chặn bằng ném lỗi có dấu hiệu nhận biết, giống cách `redirect()` và `forbidden()` của Next thoát khỏi render. */
class Redirected extends Error {
  constructor(readonly target: unknown) {
    super('redirect');
  }
}
class Forbidden extends Error {}

let viewer: MeDto | null = null;
let path: string | null = null;

vi.mock('@/lib/auth/viewer', () => ({ getViewer: async () => viewer }));
vi.mock('next/headers', () => ({
  headers: async () => new Headers(path ? { 'x-vcraft-path': path } : {}),
}));
vi.mock('next/navigation', () => ({
  forbidden: () => {
    throw new Forbidden();
  },
  redirect: (target: string) => {
    throw new Redirected(target);
  },
}));
vi.mock('@/i18n/navigation', () => ({
  getPathname: ({ href, locale }: { href: string; locale: string }) =>
    href === '/studio/ho-so' ? `/${locale}/studio/${locale === 'vi' ? 'ho-so' : 'profile'}` : href,
  redirect: (target: unknown) => {
    throw new Redirected(target);
  },
}));

const { requireArea, redirectIfSignedIn } = await import('@/lib/auth/guard');

const me = (overrides: Partial<MeDto>): MeDto => ({
  id: '22222222-2222-4222-8222-222222222222',
  email: 'ban@vidu.vn',
  fullName: null,
  role: 'BUYER',
  status: 'ACTIVE',
  emailVerified: true,
  household: null,
  ...overrides,
});

const pendingHousehold: MeDto['household'] = {
  id: '33333333-3333-4333-8333-333333333333',
  name: 'Gốm Bảo Châu',
  slug: 'gom-bao-chau',
  status: 'PENDING_REVIEW',
  statusReason: null,
};

async function outcome(run: () => Promise<unknown>): Promise<unknown> {
  try {
    return await run();
  } catch (error) {
    if (error instanceof Redirected) return { redirect: error.target };
    if (error instanceof Forbidden) return 'forbidden';
    throw error;
  }
}

beforeEach(() => {
  viewer = null;
  path = null;
});

describe('requireArea', () => {
  it('khách: chuyển tới /dang-nhap kèm đường dẫn đang xem để quay lại', async () => {
    path = '/vi/yeu-cau-bao-gia/abc?tab=2';
    expect(await outcome(() => requireArea('buyer', 'vi'))).toEqual({
      redirect: {
        href: { pathname: '/dang-nhap', query: { next: '/vi/yeu-cau-bao-gia/abc?tab=2' } },
        locale: 'vi',
      },
    });
  });

  it('không tin header đường dẫn có dạng nguy hiểm: bỏ `next` thay vì chuyển hướng ra ngoài', async () => {
    path = '//evil.test/x';
    expect(await outcome(() => requireArea('admin', 'vi'))).toEqual({
      redirect: { href: { pathname: '/dang-nhap' }, locale: 'vi' },
    });
  });

  it('đúng vai trò: được vào và nhận lại người dùng', async () => {
    viewer = me({ role: 'ADMIN' });
    expect(await outcome(() => requireArea('admin', 'vi'))).toBe(viewer);
  });

  it('sai vai trò: 403', async () => {
    viewer = me({ role: 'BUYER' });
    expect(await outcome(() => requireArea('admin', 'vi'))).toBe('forbidden');
  });

  it('hộ chờ duyệt vào trang Studio khác: chuyển về trang trạng thái hồ sơ', async () => {
    viewer = me({ role: 'HOUSEHOLD', household: pendingHousehold });
    path = '/vi/studio/de-xuat-tham-gia/abc';
    expect(await outcome(() => requireArea('studio', 'vi'))).toEqual({
      redirect: { href: '/studio/ho-so', locale: 'vi' },
    });
  });

  it('hộ chờ duyệt ở trang trạng thái (kể cả có query): được vào, không vòng lặp chuyển hướng', async () => {
    viewer = me({ role: 'HOUSEHOLD', household: pendingHousehold });
    path = '/vi/studio/ho-so?submitted=1';
    expect(await outcome(() => requireArea('studio', 'vi'))).toBe(viewer);
  });

  it('nhận ra trang trạng thái theo ngôn ngữ en', async () => {
    viewer = me({ role: 'HOUSEHOLD', household: pendingHousehold });
    path = '/en/studio/profile';
    expect(await outcome(() => requireArea('studio', 'en'))).toBe(viewer);
  });
});

describe('redirectIfSignedIn', () => {
  it('khách: ở lại trang đăng nhập', async () => {
    expect(await outcome(() => redirectIfSignedIn('vi', null))).toBeUndefined();
  });

  it('đã đăng nhập: về đích quay lại nếu có, không thì vào trang theo vai trò', async () => {
    viewer = me({ role: 'BUYER' });
    expect(await outcome(() => redirectIfSignedIn('vi', '/vi/yeu-cau-bao-gia'))).toEqual({
      redirect: '/vi/yeu-cau-bao-gia',
    });
    viewer = me({ role: 'ADMIN' });
    expect(await outcome(() => redirectIfSignedIn('vi', null))).toEqual({
      redirect: { href: '/admin', locale: 'vi' },
    });
  });
});
