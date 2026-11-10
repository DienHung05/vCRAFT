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
/** 30 zero/one counts, oldest first — the shape the API's zero-filled trend arrives in. */
const TREND = Array.from({ length: 30 }, (_, i) => ({
  date: `2026-10-${String(i + 1).padStart(2, '0')}`,
  count: i,
}));
const PENDING = {
  id: ID,
  version: 4,
  name: 'Gốm Bảo Châu',
  slug: 'gom-bao-chau',
  history: 'Hồ sơ khai.',
  village: 'Bát Tràng',
  craft: 'men lam',
  craftCategory: 'MEN',
  certifications: [
    {
      name: 'OCOP 4 sao',
      issuer: 'UBND Hà Nội',
      year: 2023,
      issuedOn: '2023-06-30',
      photo: null,
      verified: false,
    },
  ],
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
  reviewState: 'NEW',
  resubmittedAt: null,
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
      trend: TREND,
    })),
    listHouseholds: vi.fn(async () => ({
      data: [
        {
          id: ID,
          name: 'Gốm Bảo Châu',
          status: 'PENDING_REVIEW',
          submittedAt: '2026-10-01T00:00:00.000Z',
        },
      ],
      nextCursor: null,
    })),
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

  it('vẽ xu hướng quét QR kèm bảng cho trình đọc màn hình', async () => {
    renderVi(<AdminDashboard client={client()} />);
    const chart = await screen.findByRole('img', {
      name: 'Biểu đồ cột lượt quét QR theo ngày trong 30 ngày qua',
    });
    expect(chart.querySelectorAll('div')).toHaveLength(30);
    expect(chart.querySelector('div[title^="2026-10-30"]')).toBeTruthy();
    const table = screen.getByRole('table', { hidden: true });
    expect(within(table).getAllByRole('row')).toHaveLength(31); // header + 30 dates
    expect(within(table).getByText('Lượt quét')).toBeTruthy();
  });

  it('nêu rõ khi 30 ngày không có lượt quét nào', async () => {
    const dashboard = vi.fn().mockResolvedValue({
      activeHouseholds: 1,
      pendingApplications: 0,
      openRfqs: 0,
      ordersInProduction: 0,
      qrScans30Days: 0,
      trend: TREND.map((point) => ({ ...point, count: 0 })),
    });
    renderVi(<AdminDashboard client={client({ dashboard })} />);
    expect(await screen.findByText('30 ngày qua chưa có lượt quét QR nào.')).toBeTruthy();
    expect(screen.queryByRole('img')).toBeNull();
  });

  it('lỗi có thử lại', async () => {
    const dashboard = vi
      .fn()
      .mockRejectedValueOnce(new Error('mạng'))
      .mockResolvedValueOnce({
        activeHouseholds: 1,
        pendingApplications: 0,
        openRfqs: 0,
        ordersInProduction: 0,
        qrScans30Days: 0,
        trend: TREND.map((point) => ({ ...point, count: 0 })),
      });
    renderVi(<AdminDashboard client={client({ dashboard })} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Thử lại' }));
    expect(await screen.findByTestId('admin-metrics')).toBeTruthy();
  });
});

describe('HouseholdQueue', () => {
  it('xem thêm nối trang kế tiếp bằng con trỏ và ẩn nút khi hết', async () => {
    const row = (id: string, name: string) => ({
      id,
      name,
      status: 'PENDING_REVIEW',
      submittedAt: '2026-10-01T00:00:00.000Z',
    });
    const listHouseholds = vi
      .fn()
      .mockResolvedValueOnce({ data: [row('a', 'Hộ Một')], nextCursor: 'next-1' })
      .mockResolvedValueOnce({ data: [row('b', 'Hộ Hai')], nextCursor: null });
    renderVi(<HouseholdQueue client={client({ listHouseholds })} />);
    expect(await screen.findByText('Hộ Một')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Xem thêm' }));
    expect(await screen.findByText('Hộ Hai')).toBeTruthy();
    expect(screen.getByText('Hộ Một')).toBeTruthy();
    expect(listHouseholds).toHaveBeenLastCalledWith({ status: 'PENDING_REVIEW', cursor: 'next-1' });
    expect(screen.queryByRole('button', { name: 'Xem thêm' })).toBeNull();
  });

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

  it('shows the hamlet of each workshop, or that none is set (GH#294)', async () => {
    const [workshop] = PENDING.workshops;
    const household = {
      ...PENDING,
      workshops: [
        { ...workshop, id: `${ID}c`, name: 'Xưởng Giang Cao', areaCode: 'GIANG_CAO' },
        { ...workshop, id: `${ID}d`, name: 'Xưởng chưa chọn', areaCode: null },
      ],
    } as HouseholdDto;
    renderVi(
      <HouseholdReview
        householdId={ID}
        client={client({ getHousehold: vi.fn(async () => household) })}
      />,
    );
    const columns = await screen.findByTestId('review-columns');
    expect(within(columns).getByText('Khu vực: Thôn Giang Cao')).toBeTruthy();
    expect(
      within(columns).getByText(/Chưa chọn khu vực \(nhận mọi thông báo cắt điện\)/),
    ).toBeTruthy();
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

  it('says what an incomplete application still lacks when approving is refused (GH#459)', async () => {
    const api = client({
      decide: vi.fn(async () => {
        throw new ApiError('APPLICATION_INCOMPLETE', 422, [
          { path: 'workshops', code: 'required', message: 'add at least one workshop' },
          { path: 'documents', code: 'required', message: 'upload at least one document' },
        ]);
      }),
    });
    renderVi(<HouseholdReview householdId={ID} client={api} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Duyệt' }));
    confirmDialog('Duyệt');
    expect((await screen.findByRole('alert')).textContent).toBe(
      'Hồ sơ còn thiếu nên chưa duyệt được: ít nhất một xưởng, ít nhất một giấy tờ.',
    );
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

  it('lets the board mark a certification verified and remove the mark again', async () => {
    const setCertificationVerified = vi
      .fn()
      .mockResolvedValueOnce({
        ...PENDING,
        version: 5,
        certifications: [{ ...PENDING.certifications[0], verified: true }],
      })
      .mockResolvedValueOnce({ ...PENDING, version: 6 });
    renderVi(<HouseholdReview householdId={ID} client={client({ setCertificationVerified })} />);
    const card = await screen.findByTestId('review-certifications');
    expect(within(card).getByText('OCOP 4 sao')).toBeTruthy();
    expect(within(card).getByText(/30\/06\/2023/)).toBeTruthy();
    expect(within(card).getByText('Chưa xác minh')).toBeTruthy();

    fireEvent.click(
      within(card).getByRole('button', { name: 'Đánh dấu “OCOP 4 sao” đã xác minh' }),
    );
    await waitFor(() => expect(setCertificationVerified).toHaveBeenLastCalledWith(ID, 0, 4, true));
    expect(await within(card).findByText('Đã xác minh')).toBeTruthy();

    fireEvent.click(within(card).getByRole('button', { name: 'Bỏ xác minh “OCOP 4 sao”' }));
    await waitFor(() => expect(setCertificationVerified).toHaveBeenLastCalledWith(ID, 0, 5, false));
    expect(await within(card).findByText('Chưa xác minh')).toBeTruthy();
  });

  it('reloads and warns when the certification update hits a stale version', async () => {
    const setCertificationVerified = vi.fn(async () => {
      throw new ApiError('STALE_VERSION', 409);
    });
    const getHousehold = vi.fn(async () => PENDING);
    renderVi(
      <HouseholdReview
        householdId={ID}
        client={client({ setCertificationVerified, getHousehold })}
      />,
    );
    const card = await screen.findByTestId('review-certifications');
    fireEvent.click(within(card).getByRole('button', { name: /Đánh dấu/ }));
    expect(await within(card).findByRole('alert')).toBeTruthy();
    expect(getHousehold).toHaveBeenCalledTimes(2);
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
