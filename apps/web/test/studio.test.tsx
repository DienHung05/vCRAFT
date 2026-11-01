import { fireEvent, screen, waitFor } from '@testing-library/react';
import { ApiError, type StudioClient } from '@vcraft/api-client';
import type { HouseholdDto } from '@vcraft/contracts';
import { describe, expect, it, vi } from 'vitest';
import { ProfileEditor } from '@/features/studio/profile-editor';
import { StudioHome } from '@/features/studio/studio-home';
import { toWorkshopRequest } from '@/features/studio/workshop-editor';
import { renderVi } from './render';

vi.mock('next/dynamic', () => ({ default: () => () => null }));
const notifySuccess = vi.hoisted(() => vi.fn());
vi.mock('@/lib/notify', () => ({
  notify: { success: notifySuccess, error: vi.fn(), info: vi.fn() },
}));
vi.mock('@/i18n/navigation', () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a href="/x">{children}</a>,
  usePathname: () => '/studio',
}));

const HOUSEHOLD: HouseholdDto = {
  id: '00000000-0000-4000-8000-000000000001',
  version: 3,
  name: 'Gốm Minh Hải',
  slug: 'gom-minh-hai',
  history: 'Câu chuyện.',
  village: 'Bát Tràng',
  craft: 'men lam',
  coverUrl: null,
  coverVariants: [],
  portrait: null,
  banner: null,
  foundedYear: null,
  generations: null,
  timeline: [],
  certifications: [{ name: 'OCOP', issuer: 'UBND', year: 2023, verified: true }],
  gallery: [],
  capacityByCategory: {},
  artisans: [],
  workshops: [],
  visit: { showrooms: [], productionWorkshops: [] },
  products: [],
  status: 'PENDING_REVIEW',
  statusReason: null,
  approvedAt: null,
  idNumberMasked: '••••••••4567',
  completeness: { percent: 25, missing: ['story', 'timeline'] },
};

function fakeClient(overrides: Partial<StudioClient> = {}): StudioClient {
  return {
    getHousehold: vi.fn(async () => HOUSEHOLD),
    setIdNumber: vi.fn(async () => HOUSEHOLD),
    updateProfile: vi.fn(async () => HOUSEHOLD),
    addWorkshop: vi.fn(),
    updateWorkshop: vi.fn(),
    addArtisan: vi.fn(),
    getMedia: vi.fn(),
    ...overrides,
  } as unknown as StudioClient;
}

describe('StudioHome', () => {
  it('hiện trạng thái hồ sơ, phần trăm và gợi ý mục còn thiếu', async () => {
    renderVi(<StudioHome client={fakeClient()} />);
    expect(await screen.findByText('Đang chờ Ban quản lý duyệt')).toBeTruthy();
    expect(screen.getByText('25%')).toBeTruthy();
    expect(screen.getByText('Dòng thời gian gia đình')).toBeTruthy();
    expect(screen.queryByText('Xem trang công khai')).toBeNull();
  });

  it('401 mời đăng nhập; 404 báo chưa có hộ; lỗi khác có thử lại', async () => {
    const unauth = fakeClient({
      getHousehold: vi.fn(async () => {
        throw new ApiError('AUTH_UNAUTHENTICATED', 401);
      }),
    });
    const first = renderVi(<StudioHome client={unauth} />);
    expect(await screen.findByText(/Hãy đăng nhập/)).toBeTruthy();
    first.unmount();

    const missing = fakeClient({
      getHousehold: vi.fn(async () => {
        throw new ApiError('NOT_FOUND', 404);
      }),
    });
    const second = renderVi(<StudioHome client={missing} />);
    expect(await screen.findByText(/chưa đại diện cho hộ nào/)).toBeTruthy();
    second.unmount();

    const getHousehold = vi
      .fn()
      .mockRejectedValueOnce(new Error('mạng'))
      .mockResolvedValueOnce(HOUSEHOLD);
    renderVi(<StudioHome client={fakeClient({ getHousehold })} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Thử lại' }));
    expect(await screen.findByText('25%')).toBeTruthy();
  });
});

describe('ProfileEditor', () => {
  it('lưu câu chuyện kèm phiên bản đang xem', async () => {
    const client = fakeClient();
    renderVi(<ProfileEditor client={client} />);
    const story = await screen.findByLabelText('Câu chuyện của hộ');
    fireEvent.change(story, { target: { value: 'Năm đời làm gốm bên sông Hồng.' } });
    fireEvent.change(screen.getByLabelText('Năm thành lập'), { target: { value: '1962' } });
    fireEvent.click(screen.getAllByRole('button', { name: 'Lưu' })[0] as HTMLElement);
    await waitFor(() =>
      expect(client.updateProfile).toHaveBeenCalledWith(
        3,
        expect.objectContaining({
          history: 'Năm đời làm gốm bên sông Hồng.',
          foundedYear: 1962,
          generations: null,
        }),
      ),
    );
    await waitFor(() => expect(notifySuccess).toHaveBeenCalledWith('Đã lưu.'));
  });

  it('shows the citizen ID masked and replaces it with a valid 12-digit number', async () => {
    const client = fakeClient();
    renderVi(<ProfileEditor client={client} />);
    expect(await screen.findByText('••••••••4567')).toBeTruthy();
    const input = screen.getByLabelText('Đổi số CCCD (12 chữ số)');
    const save = screen.getByRole('button', { name: 'Lưu số CCCD' });

    fireEvent.change(input, { target: { value: '12345' } });
    fireEvent.click(save);
    expect((await screen.findByRole('alert')).textContent).toContain('đúng 12 chữ số');
    expect(client.setIdNumber).not.toHaveBeenCalled();

    fireEvent.change(input, { target: { value: '079203004568' } });
    fireEvent.click(save);
    await waitFor(() =>
      expect(client.setIdNumber).toHaveBeenCalledWith({ idNumber: '079203004568' }),
    );
    await waitFor(() => expect(notifySuccess).toHaveBeenCalledWith('Đã lưu số CCCD.'));
  });

  it('bản cũ (409) tải lại hồ sơ và báo cho người dùng', async () => {
    const client = fakeClient({
      updateProfile: vi.fn(async () => {
        throw new ApiError('STALE_VERSION', 409);
      }),
    });
    renderVi(<ProfileEditor client={client} />);
    await screen.findByLabelText('Câu chuyện của hộ');
    fireEvent.click(screen.getAllByRole('button', { name: 'Lưu' })[0] as HTMLElement);
    expect(await screen.findByText(/vừa được sửa ở nơi khác/)).toBeTruthy();
    expect(client.getHousehold).toHaveBeenCalledTimes(2);
  });

  it('sửa chứng nhận thì mất dấu đã xác minh trên màn hình', async () => {
    renderVi(<ProfileEditor client={fakeClient()} />);
    expect(await screen.findByText('Đã xác minh')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Tên chứng nhận'), { target: { value: 'OCOP 5 sao' } });
    expect(screen.queryByText('Đã xác minh')).toBeNull();
    expect(screen.getByText('Chưa xác minh')).toBeTruthy();
  });

  it('ảnh thiếu mô tả thì không cho lưu khối ảnh', async () => {
    const client = fakeClient({
      getHousehold: vi.fn(async () => ({
        ...HOUSEHOLD,
        gallery: [
          { mediaId: HOUSEHOLD.id, url: null, variants: [], alt: '', caption: null, credit: null },
        ],
      })),
    });
    renderVi(<ProfileEditor client={client} />);
    expect(await screen.findByText(/cần có mô tả ít nhất 3 ký tự/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Mô tả ảnh (bắt buộc)'), {
      target: { value: 'Lò nung gạch trong xưởng' },
    });
    expect(screen.queryByText(/cần có mô tả ít nhất 3 ký tự/)).toBeNull();
  });
});

describe('toWorkshopRequest', () => {
  it('chỉ gửi tọa độ khi có đủ cặp và bỏ khoảng trắng', () => {
    const body = toWorkshopRequest({
      name: ' Lò ',
      address: ' Xóm 3 ',
      purpose: 'BOTH',
      acceptsVisitors: true,
      visitingInfo: '  ',
      lat: 20.9,
      lng: null,
      hours: [{ day: 1, open: '08:00', close: '17:00' }],
    });
    expect(body).toEqual({
      name: 'Lò',
      address: 'Xóm 3',
      purpose: 'BOTH',
      acceptsVisitors: true,
      openingHours: [{ day: 1, open: '08:00', close: '17:00' }],
    });
  });
});
