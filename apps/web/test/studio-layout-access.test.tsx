import { act, screen } from '@testing-library/react';
import type { MeDto } from '@vcraft/contracts';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import StudioLayout from '@/app/[locale]/studio/layout';
import { renderVi } from './render';

vi.mock('@/lib/locale', () => ({ resolveLocale: vi.fn(async () => 'vi') }));
vi.mock('@/lib/auth/guard', () => ({ requireArea: vi.fn() }));
vi.mock('@/components/shell/public-shell', () => ({
  PublicShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock('@/features/studio/studio-nav', () => ({ StudioNav: () => <nav>studio</nav> }));
vi.mock('@/i18n/navigation', () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a href="/x">{children}</a>,
}));

// Client thật của banner gọi API qua fetch; thay bằng client giả ổn định để đếm số lần hỏi.
const outageClient = vi.hoisted(() => ({
  todayOutages: vi.fn(async () => ({
    date: '2026-11-03',
    outages: [{ from: '08:00', to: '11:30', area: 'Xóm 2', newsSlug: 'lich-cat-dien' }],
  })),
}));
vi.mock('@/lib/api/live-session', () => ({
  useLiveClient: () => ({ client: outageClient, loading: false }),
}));

const { requireArea } = await import('@/lib/auth/guard');

const me = (householdStatus: NonNullable<MeDto['household']>['status']): MeDto => ({
  id: '22222222-2222-4222-8222-222222222222',
  email: 'ho@vidu.vn',
  fullName: null,
  username: 'gom-minh-hai',
  role: 'HOUSEHOLD',
  status: 'ACTIVE',
  emailVerified: true,
  mfaRequired: false,
  household: {
    id: '33333333-3333-4333-8333-333333333333',
    name: 'Gốm Minh Hải',
    slug: 'gom-minh-hai',
    status: householdStatus,
    statusReason: null,
    reviewState: 'NEW',
    resubmittedAt: null,
  },
});

/** Dựng layout async đúng cách Next làm, rồi cho hiệu ứng của banner kịp chạy. */
async function renderStudioLayout(viewer: MeDto): Promise<void> {
  vi.mocked(requireArea).mockResolvedValue(viewer);
  const element = await StudioLayout({
    children: <p>Trang Studio</p>,
    params: Promise.resolve({ locale: 'vi' }),
  });
  await act(async () => {
    renderVi(element);
  });
  expect(screen.getByText('Trang Studio')).toBeTruthy();
}

// Exercise the layout and the real banner effect to catch requests from unapproved households.
describe('Studio layout gates on the household status (vCRAFT-56i.3.1)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each(['PENDING_REVIEW', 'REJECTED', 'SUSPENDED'] as const)(
    'a %s household never reaches the outage banner or its API',
    async (status) => {
      await renderStudioLayout(me(status));
      expect(outageClient.todayOutages).not.toHaveBeenCalled();
      expect(screen.queryByRole('status')).toBeNull();
      expect(screen.queryByText('Hôm nay cắt điện')).toBeNull();
    },
  );

  it('an approved household reaches the banner, which requests today’s outages', async () => {
    await renderStudioLayout(me('APPROVED'));
    expect(outageClient.todayOutages).toHaveBeenCalled();
    expect(await screen.findByRole('status')).toBeTruthy();
    expect(await screen.findByText('Hôm nay cắt điện')).toBeTruthy();
  });
});
