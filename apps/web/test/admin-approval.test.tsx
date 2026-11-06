import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { type AdminClient, ApiError } from '@vcraft/api-client';
import type { HouseholdDto } from '@vcraft/contracts';
import { describe, expect, it, vi } from 'vitest';
import { AdminDashboard } from '@/features/admin/admin-dashboard';
import { HouseholdQueue } from '@/features/admin/household-queue';
import { HouseholdReview } from '@/features/admin/household-review';
import { confirmDialog } from './confirm';
import { renderVi } from './render';

vi.mock('next/dynamic', () => ({ default: () => () => null }));
vi.mock('@/i18n/navigation', () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a href="/x">{children}</a>,
}));
const notifySuccess = vi.hoisted(() => vi.fn());
vi.mock('@/lib/notify', () => ({
  notify: { success: notifySuccess, error: vi.fn(), info: vi.fn() },
}));

const ID = '00000000-0000-4000-8000-000000000001';
const PENDING = {
  id: ID,
  version: 4,
  name: 'Gốm Bảo Châu',
  slug: 'gom-bao-chau',
  history: 'Hồ sơ khai.',
  village: 'Bát Tràng',
  craft: 'men lam',
  foundedYear: 1990,
  artisans: [],
  workshops: [
    {
      id: `${ID}a`,
      version: 1,
      name: 'Xưởng',
      address: 'Xóm 3',
      purpose: 'BOTH',
      acceptsVisitors: true,
      visitingInfo: null,
      openingHours: null,
      lat: null,
      lng: null,
    },
  ],
  status: 'PENDING_REVIEW',
  statusReason: null,
  approvedAt: null,
  idNumberMasked: '••••••••4567',
} as unknown as HouseholdDto;

function client(overrides: Partial<AdminClient> = {}): AdminClient {
  return {
    dashboard: vi.fn(async () => ({
      activeHouseholds: 20,
      pendingApplications: 1,
      openRfqs: 5,
      ordersInProduction: 2,
      qrScans30Days: 37,
    })),
    listHouseholds: vi.fn(async () => [
      {
        id: ID,
        name: 'Gốm Bảo Châu',
        status: 'PENDING_REVIEW',
        submittedAt: '2026-10-01T00:00:00.000Z',
      },
    ]),
    getHousehold: vi.fn(async () => PENDING),
    revealIdNumber: vi.fn(async () => ({ idNumber: '079203004567' })),
    documents: vi.fn(async () => ({
      data: [
        {
          id: `${ID}d`,
          mimeType: 'application/pdf',
          sizeBytes: 9,
          createdAt: '2026-10-01T00:00:00.000Z',
        },
      ],
    })),
    documentUrl: vi.fn(async () => ({
      url: 'https://signed/x',
      expiresAt: '2026-10-01T00:05:00.000Z',
    })),
    decide: vi.fn(async () => ({ ...PENDING, status: 'APPROVED', version: 5 })),
    ...overrides,
  } as unknown as AdminClient;
}

describe('AdminDashboard', () => {
  it('hiện đủ năm số liệu và lối vào hàng đợi', async () => {
    renderVi(<AdminDashboard client={client()} />);
    const metrics = await screen.findByTestId('admin-metrics');
    expect(within(metrics).getByText('37')).toBeTruthy();
    expect(metrics.querySelectorAll('dd')).toHaveLength(5);
    expect(screen.getByText(/1 hồ sơ/)).toBeTruthy();
  });

  it('lỗi có thử lại', async () => {
    const dashboard = vi.fn().mockRejectedValueOnce(new Error('mạng')).mockResolvedValueOnce({
      activeHouseholds: 1,
      pendingApplications: 0,
      openRfqs: 0,
      ordersInProduction: 0,
      qrScans30Days: 0,
    });
    renderVi(<AdminDashboard client={client({ dashboard })} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Thử lại' }));
    expect(await screen.findByTestId('admin-metrics')).toBeTruthy();
  });
});

describe('HouseholdQueue', () => {
  it('mặc định lọc hồ sơ chờ; đổi trạng thái và ngày gọi lại API', async () => {
    const api = client();
    renderVi(<HouseholdQueue client={api} />);
    expect(await screen.findByText('Gốm Bảo Châu')).toBeTruthy();
    expect(api.listHouseholds).toHaveBeenCalledWith({ status: 'PENDING_REVIEW' });
    fireEvent.change(screen.getByLabelText('Từ ngày'), { target: { value: '2026-10-01' } });
    await waitFor(() =>
      expect(api.listHouseholds).toHaveBeenLastCalledWith({
        status: 'PENDING_REVIEW',
        from: '2026-10-01',
      }),
    );
  });
});

describe('HouseholdReview', () => {
  it('hiện song song khai báo, giấy tờ, xưởng; xưởng thiếu tọa độ được báo', async () => {
    renderVi(<HouseholdReview householdId={ID} client={client()} />);
    const columns = await screen.findByTestId('review-columns');
    expect(within(columns).getByText('Hồ sơ khai.')).toBeTruthy();
    expect(within(columns).getByText('application/pdf')).toBeTruthy();
    expect(within(columns).getByText(/chưa khai vị trí/)).toBeTruthy();
  });

  it('flags a workshop pinned outside Bát Tràng commune, not one inside', async () => {
    const [workshop] = PENDING.workshops;
    const household = {
      ...PENDING,
      workshops: [
        { ...workshop, id: `${ID}b`, name: 'Xưởng trong làng', lat: 20.9765, lng: 105.9135 },
        { ...workshop, id: `${ID}c`, name: 'Xưởng Hoàn Kiếm', lat: 21.0287, lng: 105.8524 },
      ],
    } as HouseholdDto;
    renderVi(
      <HouseholdReview
        householdId={ID}
        client={client({ getHousehold: vi.fn(async () => household) })}
      />,
    );
    const flags = await screen.findAllByText('Ghim ngoài ranh giới xã Bát Tràng');
    expect(flags).toHaveLength(1);
    expect(flags[0]?.closest('li')?.textContent).toContain('Xưởng Hoàn Kiếm');
  });

  it('shows the citizen ID masked and reveals the full number only on request', async () => {
    const api = client();
    renderVi(<HouseholdReview householdId={ID} client={api} />);
    const columns = await screen.findByTestId('review-columns');
    expect(within(columns).getByText('••••••••4567')).toBeTruthy();
    expect(columns.textContent).not.toContain('079203004567');
    expect(api.revealIdNumber).not.toHaveBeenCalled();

    fireEvent.click(within(columns).getByRole('button', { name: 'Xem số đầy đủ' }));
    expect((await screen.findByTestId('revealed-id-number')).textContent).toBe('079203004567');
    expect(api.revealIdNumber).toHaveBeenCalledWith(ID);

    fireEvent.click(within(columns).getByRole('button', { name: 'Ẩn' }));
    expect(columns.textContent).not.toContain('079203004567');
    expect(within(columns).getByText('••••••••4567')).toBeTruthy();
  });

  it('says so when no citizen ID number is on record, and when the reveal fails', async () => {
    const none = client({
      getHousehold: vi.fn(async () => ({ ...PENDING, idNumberMasked: null })),
    });
    const { unmount } = renderVi(<HouseholdReview householdId={ID} client={none} />);
    expect(await screen.findByText('Chưa khai')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Xem số đầy đủ' })).toBeNull();
    unmount();

    const failing = client({
      revealIdNumber: vi.fn().mockRejectedValue(new ApiError('INTERNAL_ERROR', 500)),
    });
    renderVi(<HouseholdReview householdId={ID} client={failing} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Xem số đầy đủ' }));
    expect((await screen.findByRole('alert')).textContent).toContain('Chưa xem được số CCCD');
  });

  it('duyệt gửi đúng phiên bản và đóng ấn', async () => {
    const api = client();
    renderVi(<HouseholdReview householdId={ID} client={api} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Duyệt' }));
    // Every decision waits for a confirmation.
    expect(api.decide).not.toHaveBeenCalled();
    confirmDialog('Duyệt');
    await waitFor(() => expect(api.decide).toHaveBeenCalledWith(ID, 'approve', 4, ''));
    await waitFor(() => expect(notifySuccess).toHaveBeenCalledWith('Đã duyệt và đóng ấn.'));
    expect(screen.getByRole('button', { name: 'Tạm khóa hộ' })).toBeTruthy();
  });

  it('từ chối và yêu cầu bổ sung phải có lý do', async () => {
    const api = client();
    renderVi(<HouseholdReview householdId={ID} client={api} />);
    const reject = (await screen.findByRole('button', { name: 'Từ chối' })) as HTMLButtonElement;
    expect(reject.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('Lý do'), { target: { value: 'Thiếu giấy cư trú' } });
    expect(reject.disabled).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Yêu cầu bổ sung' }));
    confirmDialog('Yêu cầu bổ sung');
    await waitFor(() =>
      expect(api.decide).toHaveBeenCalledWith(ID, 'request-info', 4, 'Thiếu giấy cư trú'),
    );
  });

  it('hộ bị khóa có nút mở khóa; bản cũ (409) tải lại và báo', async () => {
    const api = client({
      getHousehold: vi.fn(async () => ({ ...PENDING, status: 'SUSPENDED' as const })),
      decide: vi.fn(async () => {
        throw new ApiError('STALE_VERSION', 409);
      }),
    });
    renderVi(<HouseholdReview householdId={ID} client={api} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Mở khóa hộ' }));
    confirmDialog('Mở khóa hộ');
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(api.getHousehold).toHaveBeenCalledTimes(2);
  });

  it('không tìm thấy hộ', async () => {
    const api = client({
      getHousehold: vi.fn(async () => {
        throw new ApiError('NOT_FOUND', 404);
      }),
    });
    renderVi(<HouseholdReview householdId={ID} client={api} />);
    expect(await screen.findByText(/Không tìm thấy hộ/)).toBeTruthy();
  });
});
