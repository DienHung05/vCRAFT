import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { QuotationApiError, type QuotationClient } from '@vcraft/api-client';
import type { MyAllocationDto, MyInvitationDto, RfqResponse } from '@vcraft/contracts';
import { describe, expect, it, vi } from 'vitest';
import { LiveContributionWorkspace } from '@/features/rfq/live-contribution-workspace';
import { QuotationInvitations } from '@/features/studio/quotation-invitations';
import { StudioAllocations } from '@/features/studio/studio-allocations';
import { confirmDialog } from './confirm';
import { renderVi } from './render';

vi.mock('@/i18n/navigation', () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a href="/x">{children}</a>,
}));

const ID = '123e4567-e89b-12d3-a456-426614174000';
const REQUEST: RfqResponse = {
  id: ID,
  version: 4,
  revision: 1,
  status: 'SENT',
  title: 'Logo cups',
  category: null,
  budgetMinVnd: null,
  budgetMaxVnd: null,
  cancelReason: null,
  createdAt: '2099-01-01T00:00:00.000Z',
  design: 'Cups with a logo',
  quantity: 100,
  unit: 'cup',
  destination: 'Hanoi',
  requiredBy: '2100-02-01T00:00:00.000Z',
  biddingClosesAt: '2099-12-01T00:00:00.000Z',
  invitedHouseholdIds: [ID],
  coordinationOptIn: true,
  declinedByMe: false,
};
const OFFER = {
  id: ID,
  version: 2,
  householdId: ID,
  maxQuantity: 60,
  unitPriceVnd: 30_000,
  completionDate: '2100-01-01T00:00:00.000Z',
  status: 'ACTIVE' as const,
};
const ALLOCATION: MyAllocationDto = {
  id: ID,
  version: 3,
  householdId: ID,
  householdName: 'Gốm Minh Hải',
  startedAt: '2099-01-01T00:00:00Z',
  dueAt: '2100-01-01T00:00:00Z',
  lateness: 'ON_TRACK',
  expectedQty: 40,
  progressPercent: 40,
  quantity: 100,
  completedQty: 40,
  status: 'IN_PROGRESS',
  progressLog: [
    {
      at: '2099-06-01T00:00:00.000Z',
      completedQty: 40,
      note: 'First firing done',
      photoUrl: null,
    },
  ],
  requestId: ID,
  requestTitle: 'Logo cups',
  requestStatus: 'IN_PRODUCTION',
  unit: 'cup',
  requiredBy: '2100-02-01T00:00:00.000Z',
  completionDate: '2100-01-01T00:00:00.000Z',
};
const asClient = (methods: object) => methods as unknown as QuotationClient;

describe('QuotationInvitations', () => {
  it('shows the deadline countdown and the household own offer', async () => {
    const rows: MyInvitationDto[] = [
      { request: REQUEST, contribution: OFFER, declined: false },
      {
        request: { ...REQUEST, id: `${ID}1`, title: 'No offer yet' },
        contribution: null,
        declined: false,
      },
      {
        request: { ...REQUEST, id: `${ID}2`, title: 'Said no' },
        contribution: null,
        declined: true,
      },
    ];
    renderVi(
      <QuotationInvitations
        client={asClient({ listInvitations: vi.fn().mockResolvedValue(rows) })}
      />,
    );
    expect(await screen.findByText('Logo cups')).toBeTruthy();
    expect(screen.getByText(/Đã gửi:.*tối đa 60/)).toBeTruthy();
    expect(screen.getByText('Chưa gửi đề xuất')).toBeTruthy();
    expect(screen.getByText('Đã từ chối')).toBeTruthy();
    await waitFor(() => expect(screen.getAllByText(/Còn .+ ngày/).length).toBeGreaterThan(0));
  });

  it('marks a request past its deadline as closed, without a countdown', async () => {
    const closed: MyInvitationDto = {
      request: { ...REQUEST, status: 'EXPIRED', biddingClosesAt: '2020-01-01T00:00:00.000Z' },
      contribution: null,
      declined: false,
    };
    renderVi(
      <QuotationInvitations
        client={asClient({ listInvitations: vi.fn().mockResolvedValue([closed]) })}
      />,
    );
    expect(await screen.findByText('Đã đóng')).toBeTruthy();
    expect(screen.queryByText(/Còn .+ ngày/)).toBeNull();
  });

  it('offers a retry when loading fails, and an empty message', async () => {
    const listInvitations = vi
      .fn()
      .mockRejectedValueOnce(new QuotationApiError('INTERNAL_ERROR', 500))
      .mockResolvedValue([]);
    renderVi(
      <QuotationInvitations
        client={asClient({
          listInvitations,
          listOpenCoordinatedRequests: vi.fn().mockResolvedValue([]),
        })}
      />,
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Thử lại' }));
    expect(await screen.findByText('Hộ chưa có lời mời nào.')).toBeTruthy();
  });

  it('explains the BR-05 invitation rule in the empty state, with links to act on it', async () => {
    renderVi(
      <QuotationInvitations
        client={asClient({ listInvitations: vi.fn().mockResolvedValue([]) })}
      />,
    );
    const rule = await screen.findByTestId('invitation-rule');
    expect(within(rule).getByText('Khi nào hộ được mời?')).toBeTruthy();
    expect(within(rule).getByText(/đã được Ban quản lý duyệt/)).toBeTruthy();
    expect(within(rule).getByText(/không bị khóa/)).toBeTruthy();
    expect(within(rule).getByText(/có chọn nhóm sản phẩm/)).toBeTruthy();
    expect(within(rule).getByText(/khai năng lực sản xuất cho nhóm đó/)).toBeTruthy();
    expect(within(rule).getByText(/Ban quản lý sẽ tự chọn hộ/)).toBeTruthy();
    expect(within(rule).getByRole('link', { name: 'Khai năng lực sản xuất' })).toBeTruthy();
    expect(within(rule).getByRole('link', { name: 'Thêm sản phẩm' })).toBeTruthy();
  });
});

describe('Decline in the contribution workspace', () => {
  /** RFQ stage stepper (FR-RFQ-12): every household RFQ screen shows the shared stage model. */
  const stepper = () =>
    within(screen.getByRole('navigation', { name: 'Tiến trình của yêu cầu báo giá' }));
  const currentStage = () => stepper().getByRole('listitem', { current: 'step' }).textContent;
  const workspace = (overrides: object) =>
    asClient({
      getRequest: vi.fn().mockResolvedValue(REQUEST),
      listOwnContributions: vi.fn().mockResolvedValue([]),
      priceHint: vi.fn().mockResolvedValue({ hint: null }),
      ...overrides,
    });

  it('declines an invitation when no offer is active', async () => {
    const declineInvitation = vi.fn().mockResolvedValue(REQUEST);
    const getRequest = vi
      .fn()
      .mockResolvedValueOnce(REQUEST)
      .mockResolvedValue({ ...REQUEST, declinedByMe: true });
    renderVi(
      <LiveContributionWorkspace
        rfqId={ID}
        client={workspace({ declineInvitation, getRequest })}
      />,
    );
    const decline = await screen.findByRole('button', { name: 'Từ chối lời mời' });
    expect(currentStage()).toContain('Đã gửi');
    fireEvent.click(decline);
    expect(declineInvitation).not.toHaveBeenCalled();
    confirmDialog('Từ chối lời mời');
    await waitFor(() => expect(declineInvitation).toHaveBeenCalledWith(ID));
    expect(await screen.findByText(/Hộ đã từ chối lời mời này/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Từ chối lời mời' })).toBeNull();
  });

  it('hides decline while an offer is active', async () => {
    renderVi(
      <LiveContributionWorkspace
        rfqId={ID}
        client={workspace({ listOwnContributions: vi.fn().mockResolvedValue([OFFER]) })}
      />,
    );
    await screen.findByText('Logo cups');
    expect(screen.queryByRole('button', { name: 'Từ chối lời mời' })).toBeNull();
  });
});

describe('StudioAllocations', () => {
  it('confirms or declines a proposed allocation with its version', async () => {
    const confirmAllocation = vi.fn().mockResolvedValue({});
    const listMyAllocations = vi
      .fn()
      .mockResolvedValueOnce([{ ...ALLOCATION, status: 'PROPOSED', progressLog: [] }])
      .mockResolvedValue([{ ...ALLOCATION, status: 'CONFIRMED', version: 4, progressLog: [] }]);
    renderVi(<StudioAllocations client={asClient({ listMyAllocations, confirmAllocation })} />);
    expect(await screen.findByRole('button', { name: 'Từ chối' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận' }));
    await waitFor(() => expect(confirmAllocation).toHaveBeenCalledWith(ID, 3));
    expect(await screen.findByText('Đã xác nhận')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Xác nhận' })).toBeNull();
  });

  it('reports quantity, note and photo, and shows the earlier reports', async () => {
    const reportProgress = vi.fn().mockResolvedValue({});
    const uploadPhoto = vi.fn().mockResolvedValue('media-id');
    renderVi(
      <StudioAllocations
        client={asClient({
          listMyAllocations: vi.fn().mockResolvedValue([ALLOCATION]),
          reportProgress,
        })}
        uploadPhoto={uploadPhoto}
      />,
    );
    expect(await screen.findByText('First firing done')).toBeTruthy();
    fireEvent.change(screen.getByLabelText(/số lượng đã xong/i), { target: { value: '70' } });
    fireEvent.change(screen.getByLabelText('Ghi chú (không bắt buộc)'), {
      target: { value: 'Second firing' },
    });
    const file = new File(['x'], 'p.jpg', { type: 'image/jpeg' });
    fireEvent.change(screen.getByLabelText('Ảnh tiến độ (không bắt buộc)'), {
      target: { files: [file] },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Báo cáo' }));
    await waitFor(() =>
      expect(reportProgress).toHaveBeenCalledWith(ID, 3, {
        completedQty: 70,
        note: 'Second firing',
        photoMediaId: 'media-id',
      }),
    );
    expect(uploadPhoto).toHaveBeenCalled();
  });

  it('rejects a quantity outside the allocation without calling the API', async () => {
    const reportProgress = vi.fn();
    renderVi(
      <StudioAllocations
        client={asClient({
          listMyAllocations: vi.fn().mockResolvedValue([ALLOCATION]),
          reportProgress,
        })}
      />,
    );
    fireEvent.change(await screen.findByLabelText(/số lượng đã xong/i), {
      target: { value: '101' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Báo cáo' }));
    expect(await screen.findByText(/từ 0 đến 100/)).toBeTruthy();
    expect(reportProgress).not.toHaveBeenCalled();
  });

  it('keeps the report unsent when the photo fails', async () => {
    const reportProgress = vi.fn();
    renderVi(
      <StudioAllocations
        client={asClient({
          listMyAllocations: vi.fn().mockResolvedValue([ALLOCATION]),
          reportProgress,
        })}
        uploadPhoto={vi.fn().mockRejectedValue(new Error('photo-not-ready'))}
      />,
    );
    fireEvent.change(await screen.findByLabelText(/số lượng đã xong/i), {
      target: { value: '70' },
    });
    fireEvent.change(screen.getByLabelText('Ảnh tiến độ (không bắt buộc)'), {
      target: { files: [new File(['x'], 'p.jpg', { type: 'image/jpeg' })] },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Báo cáo' }));
    expect(await screen.findByText(/Không tải được ảnh/)).toBeTruthy();
    expect(reportProgress).not.toHaveBeenCalled();
  });
});
