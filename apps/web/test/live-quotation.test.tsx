import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { QuotationApiError, type QuotationClient } from '@vcraft/api-client';
import type { CoordinationDto, RfqResponse } from '@vcraft/contracts';
import { describe, expect, it, vi } from 'vitest';
import { LiveCoordination } from '@/features/admin/live-coordination';
import { LiveAllocationWorkspace } from '@/features/orders/live-allocation-workspace';
import { LiveContributionWorkspace } from '@/features/rfq/live-contribution-workspace';
import { notify } from '@/lib/notify';
import { confirmDialog, openDialog } from './confirm';
import { renderVi } from './render';

vi.mock('@/lib/notify', () => ({
  notify: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

vi.mock('@/i18n/navigation', () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a href="/x">{children}</a>,
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

const id = '123e4567-e89b-12d3-a456-426614174000';
const request: RfqResponse = {
  id,
  version: 4,
  revision: 1,
  status: 'SENT',
  title: 'Logo cups',
  category: null,
  budgetMinVnd: null,
  budgetMaxVnd: null,
  cancelReason: null,
  createdAt: '2099-01-01T00:00:00.000Z',
  design: 'Logo cups',
  quantity: 5,
  unit: 'cốc',
  destination: 'Ha Noi',
  requiredBy: '2100-02-01T00:00:00.000Z',
  biddingClosesAt: '2099-12-01T00:00:00.000Z',
  invitedHouseholdIds: [id],
  coordinationOptIn: true,
};
const coordination: CoordinationDto = {
  request,
  contributions: [
    {
      id,
      version: 2,
      householdId: id,
      householdName: 'Gốm Minh Hải',
      maxQuantity: 5,
      unitPriceVnd: 30_000,
      completionDate: '2100-01-01T00:00:00.000Z',
      status: 'ACTIVE',
    },
  ],
};

const orderClient = (status: RfqResponse['status'], overrides: Partial<QuotationClient> = {}) =>
  ({
    getCoordination: vi
      .fn()
      .mockResolvedValue({ ...coordination, request: { ...request, status } }),
    listNotices: vi.fn().mockResolvedValue([]),
    ...overrides,
  }) as unknown as QuotationClient;

describe('live quotation workspaces', () => {
  it('claims a SENT request before its first full quotation', async () => {
    const client = {
      getCoordination: vi
        .fn()
        .mockRejectedValueOnce(new QuotationApiError('NOT_FOUND', 404))
        .mockResolvedValue(coordination),
      getRequest: vi.fn().mockResolvedValue(request),
      coordinate: vi.fn().mockResolvedValue(request),
      listNotices: vi.fn().mockResolvedValue([]),
    } as unknown as QuotationClient;
    renderVi(<LiveCoordination rfqId={id} client={client} />);
    const claim = await screen.findByRole('button', { name: 'Nhận điều phối' });
    expect((claim as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(claim);
    await waitFor(() => expect(client.coordinate).toHaveBeenCalledWith(id, 4));
    expect(await screen.findByLabelText('Nhập số lượng cho Gốm Minh Hải')).toBeTruthy();
  });

  it('submits the first quotation from SENT with current request and contribution versions', async () => {
    const client = {
      getCoordination: vi.fn().mockResolvedValue(coordination),
      listNotices: vi.fn().mockResolvedValue([]),
      submitQuotation: vi.fn().mockResolvedValue({}),
    } as unknown as QuotationClient;
    renderVi(<LiveCoordination rfqId={id} client={client} />);
    fireEvent.change(await screen.findByLabelText('Nhập số lượng cho Gốm Minh Hải'), {
      target: { value: '5' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Gửi chào giá liên kết' }));
    confirmDialog('Gửi chào giá liên kết');
    await waitFor(() =>
      expect(client.submitQuotation).toHaveBeenCalledWith(id, 4, {
        parts: [
          {
            householdId: id,
            quantity: 5,
            unitPriceVnd: 30_000,
            completionDate: '2100-01-01T00:00:00.000Z',
            contributionVersion: 2,
          },
        ],
        additionalChargeVnd: 0,
        deliveryTerms: 'INCLUDED',
      }),
    );
  });

  it('updates a withdrawn contribution rather than creating a duplicate', async () => {
    const offer = { ...coordination.contributions[0], status: 'WITHDRAWN', version: 7 };
    const client = {
      getRequest: vi.fn().mockResolvedValue(request),
      listOwnContributions: vi.fn().mockResolvedValue([offer]),
      priceHint: vi.fn().mockResolvedValue({ hint: null }),
      updateContribution: vi.fn().mockResolvedValue({ ...offer, version: 8, status: 'ACTIVE' }),
      createContribution: vi.fn(),
    } as unknown as QuotationClient;
    renderVi(<LiveContributionWorkspace rfqId={id} client={client} />);
    const update = await screen.findByRole('button', { name: 'Cập nhật đề xuất' });
    expect((update as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(update);
    await waitFor(() =>
      expect(client.updateContribution).toHaveBeenCalledWith(id, 7, {
        maxQuantity: 5,
        unitPriceVnd: 30_000,
        completionDate: '2100-01-01T00:00:00.000Z',
      }),
    );
    expect(client.createContribution).not.toHaveBeenCalled();
  });

  it('keeps the typed plan and says the data changed when a split save is stale (BR-L1)', async () => {
    const newer = { ...coordination, request: { ...request, version: 5 } };
    const client = {
      getCoordination: vi.fn().mockResolvedValueOnce(coordination).mockResolvedValue(newer),
      listNotices: vi.fn().mockResolvedValue([]),
      submitQuotation: vi
        .fn()
        .mockRejectedValueOnce(new QuotationApiError('STALE_VERSION', 409))
        .mockResolvedValue({}),
    } as unknown as QuotationClient;
    renderVi(<LiveCoordination rfqId={id} client={client} />);
    fireEvent.change(await screen.findByLabelText('Nhập số lượng cho Gốm Minh Hải'), {
      target: { value: '5' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Gửi chào giá liên kết' }));
    confirmDialog('Gửi chào giá liên kết');
    await waitFor(() => expect(client.getCoordination).toHaveBeenCalledTimes(2));
    // The board remounted on version 5 but the plan is still there, with the stale notice.
    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toContain('Dữ liệu vừa được cập nhật'),
    );
    expect(
      (screen.getByLabelText('Nhập số lượng cho Gốm Minh Hải') as HTMLInputElement).value,
    ).toBe('5');
    fireEvent.click(screen.getByRole('button', { name: 'Gửi chào giá liên kết' }));
    confirmDialog('Gửi chào giá liên kết');
    await waitFor(() =>
      expect(client.submitQuotation).toHaveBeenLastCalledWith(id, 5, expect.anything()),
    );
  });

  it.each([
    ['ACCEPTED', 'Đã chốt'],
    ['IN_PRODUCTION', 'Đang sản xuất'],
    ['DELIVERED', 'Đã giao'],
  ] as const)(
    'on a %s order hides the split board and the expired notice and names the status',
    async (status, label) => {
      renderVi(<LiveCoordination rfqId={id} client={orderClient(status)} />);
      expect(await screen.findByText(label)).toBeTruthy();
      expect(screen.queryByText(status)).toBeNull();
      expect(screen.queryByLabelText('Nhập số lượng cho Gốm Minh Hải')).toBeNull();
      expect(screen.queryByRole('button', { name: 'Gửi chào giá liên kết' })).toBeNull();
      expect(screen.queryByText(/đã hết hạn chào giá/)).toBeNull();
    },
  );

  it('cancels an ACCEPTED order with a reason (T7)', async () => {
    const cancelOrder = vi.fn().mockResolvedValue({});
    renderVi(<LiveCoordination rfqId={id} client={orderClient('ACCEPTED', { cancelOrder })} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Hủy đơn' }));
    fireEvent.change(within(openDialog()).getByRole('textbox', { hidden: true }), {
      target: { value: 'Buyer withdrew' },
    });
    confirmDialog('Hủy đơn');
    await waitFor(() =>
      expect(cancelOrder).toHaveBeenCalledWith(id, 4, { reason: 'Buyer withdrew' }),
    );
  });

  it('reports a refused production start in a toast and keeps the page', async () => {
    const startProduction = vi
      .fn()
      .mockRejectedValue(new QuotationApiError('INVALID_TRANSITION', 409));
    renderVi(<LiveCoordination rfqId={id} client={orderClient('ACCEPTED', { startProduction })} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Bắt đầu sản xuất' }));
    confirmDialog('Bắt đầu sản xuất');
    await waitFor(() =>
      expect(notify.error).toHaveBeenCalledWith(expect.stringContaining('Chưa thể')),
    );
    expect(screen.queryByText('Tải không thành công.')).toBeNull();
    expect(screen.getByRole('button', { name: 'Hủy đơn' })).toBeTruthy();
  });

  it('titles the offer page with the request title, not its id', async () => {
    const client = {
      getRequest: vi.fn().mockResolvedValue(request),
      listOwnContributions: vi.fn().mockResolvedValue([]),
      priceHint: vi.fn().mockResolvedValue({ hint: null }),
    } as unknown as QuotationClient;
    renderVi(<LiveContributionWorkspace rfqId={id} client={client} />);
    expect(await screen.findByText('Đề xuất tham gia cho Logo cups')).toBeTruthy();
    expect(screen.queryByText(new RegExp(id))).toBeNull();
  });

  it('shows an empty state, not an error, while a request has no allocations yet', async () => {
    const client = { listAllocations: vi.fn().mockResolvedValue([]) } as unknown as QuotationClient;
    renderVi(<LiveAllocationWorkspace rfqId={id} client={client} />);
    expect(await screen.findByText('Chưa có phân bổ nào cho đơn này.')).toBeTruthy();
    expect(screen.queryByText('Không tải được phân bổ.')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Thử lại' })).toBeNull();
  });
});
