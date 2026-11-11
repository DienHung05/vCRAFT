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
      expect(client.submitQuotation).toHaveBeenCalledWith(
        id,
        4,
        {
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
        },
        {
          idempotencyKey: expect.any(String),
        },
      ),
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
        completionDate: '2100-01-01T16:59:59.000Z',
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
      expect(client.submitQuotation).toHaveBeenLastCalledWith(
        id,
        5,
        expect.anything(),
        expect.anything(),
      ),
    );
  });

  // GH#444: an admin's plan is a state change; a retried submit reuses the key of the same plan.
  it('retains the cooperative plan key after a failed submit and replaces it for a changed plan', async () => {
    const submitQuotation = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('Request timed out'))
      .mockResolvedValue({});
    const client = {
      getCoordination: vi.fn().mockResolvedValue(coordination),
      listNotices: vi.fn().mockResolvedValue([]),
      submitQuotation,
    } as unknown as QuotationClient;
    renderVi(<LiveCoordination rfqId={id} client={client} />);
    fireEvent.change(await screen.findByLabelText('Nhập số lượng cho Gốm Minh Hải'), {
      target: { value: '5' },
    });
    const send = () => {
      fireEvent.click(screen.getByRole('button', { name: 'Gửi chào giá liên kết' }));
      confirmDialog('Gửi chào giá liên kết');
    };
    send();
    await waitFor(() => expect(submitQuotation).toHaveBeenCalledTimes(1));
    await screen.findByRole('alert');
    send();
    await waitFor(() => expect(submitQuotation).toHaveBeenCalledTimes(2));

    const first = submitQuotation.mock.calls[0]?.[3]?.idempotencyKey;
    expect(first).toEqual(expect.any(String));
    expect(submitQuotation.mock.calls[1]?.[3]?.idempotencyKey).toBe(first);

    // Hand-editing the split makes it a different plan: the next submit needs a new key.
    fireEvent.change(screen.getByLabelText('Phụ phí giao hàng'), {
      target: { value: '1000' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Gửi chào giá liên kết' }));
    confirmDialog('Gửi chào giá liên kết');
    await waitFor(() => expect(submitQuotation).toHaveBeenCalledTimes(3));
    expect(submitQuotation.mock.calls[2]?.[3]?.idempotencyKey).not.toBe(first);
  });

  // GH#444: a committed-but-timed-out submit bumps the request version when the page polls again. The
  // retry of the same plan must keep both its key and the version it was first sent against.
  it('reuses the failed plan key and its original version after polling sees a newer request', async () => {
    const newer = { ...coordination, request: { ...request, version: 5 } };
    const submitQuotation = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('Request timed out'))
      .mockRejectedValueOnce(new TypeError('Request timed out'))
      .mockResolvedValue({});
    const client = {
      getCoordination: vi.fn().mockResolvedValueOnce(coordination).mockResolvedValue(newer),
      listNotices: vi.fn().mockResolvedValue([]),
      submitQuotation,
    } as unknown as QuotationClient;
    renderVi(<LiveCoordination rfqId={id} client={client} />);
    const fill = async (value: string) => {
      fireEvent.change(await screen.findByLabelText('Nhập số lượng cho Gốm Minh Hải'), {
        target: { value },
      });
    };
    const send = () => {
      fireEvent.click(screen.getByRole('button', { name: 'Gửi chào giá liên kết' }));
      confirmDialog('Gửi chào giá liên kết');
    };
    await fill('5');
    send();
    await waitFor(() => expect(submitQuotation).toHaveBeenCalledTimes(1));
    await screen.findByRole('alert');

    // The next poll (here a visibility refresh) loads version 5, from our own committed write.
    fireEvent(document, new Event('visibilitychange'));
    await waitFor(() => expect(client.getCoordination).toHaveBeenCalledTimes(2));
    await fill('5');
    send();
    await waitFor(() => expect(submitQuotation).toHaveBeenCalledTimes(2));

    // A second timeout must not adopt the polled version either: the third try is still version 4.
    await screen.findByRole('alert');
    fireEvent(document, new Event('visibilitychange'));
    await waitFor(() => expect(client.getCoordination).toHaveBeenCalledTimes(3));
    await fill('5');
    send();
    await waitFor(() => expect(submitQuotation).toHaveBeenCalledTimes(3));

    const first = submitQuotation.mock.calls[0];
    expect(first?.[1]).toBe(4);
    for (const call of submitQuotation.mock.calls.slice(1)) {
      expect(call[0]).toBe(id);
      // Same plan: the version of the first failed attempt, not the polled one, and the retained key.
      expect(call[1]).toBe(4);
      expect(call[2]).toEqual(first?.[2]);
      expect(call[3]?.idempotencyKey).toBe(first?.[3]?.idempotencyKey);
    }
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
      expect(cancelOrder).toHaveBeenCalledWith(
        id,
        4,
        { reason: 'Buyer withdrew' },
        {
          idempotencyKey: expect.any(String),
        },
      ),
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

  // GH#444: accepting on the customer's behalf, receiving and cancelling are retryable state changes.
  it('sends the key of the customer acceptance with the target, version and quotation', async () => {
    const customerRequest = {
      ...request,
      onBehalfOf: { name: 'Nguyen Van An', phone: '0912345678' },
    };
    const quotation = {
      id,
      version: 1,
      status: 'SUBMITTED' as const,
      bidType: 'COOPERATIVE' as const,
      quantity: 5,
      parts: [
        {
          householdId: id,
          householdName: 'Gốm Minh Hải',
          quantity: 5,
          unitPriceVnd: 30_000,
          completionDate: '2100-01-01T00:00:00.000Z',
          contributionVersion: 2,
        },
      ],
      productionTotalVnd: 150_000,
      additionalChargeVnd: 0,
      totalVnd: 150_000,
      deliveryTerms: 'INCLUDED' as const,
    };
    const acceptQuotation = vi.fn().mockResolvedValue({});
    const client = {
      getCoordination: vi.fn().mockResolvedValue({ ...coordination, request: customerRequest }),
      listNotices: vi.fn().mockResolvedValue([]),
      listInternalQuotations: vi.fn().mockResolvedValue([quotation]),
      listAllocations: vi.fn().mockResolvedValue([]),
      acceptQuotation,
    } as unknown as QuotationClient;
    renderVi(<LiveCoordination rfqId={id} client={client} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Chốt thay khách' }));
    confirmDialog('Chốt thay khách');
    await waitFor(() =>
      expect(acceptQuotation).toHaveBeenCalledWith(
        id,
        4,
        { quotationId: id },
        { idempotencyKey: expect.any(String) },
      ),
    );
  });

  it('sends the key of the receipt confirmation with the current request version', async () => {
    const confirmReceipt = vi.fn().mockResolvedValue({});
    renderVi(
      <LiveCoordination rfqId={id} client={orderClient('IN_PRODUCTION', { confirmReceipt })} />,
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Xác nhận đã nhận hàng' }));
    confirmDialog('Xác nhận đã nhận hàng');
    await waitFor(() =>
      expect(confirmReceipt).toHaveBeenCalledWith(id, 4, {
        idempotencyKey: expect.any(String),
      }),
    );
  });

  it('gives each order action its own key and a changed cancellation reason a new one', async () => {
    const confirmReceipt = vi.fn().mockResolvedValue({});
    const cancelOrder = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('Request timed out'))
      .mockResolvedValue({});
    renderVi(
      <LiveCoordination
        rfqId={id}
        client={orderClient('IN_PRODUCTION', { confirmReceipt, cancelOrder })}
      />,
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Xác nhận đã nhận hàng' }));
    confirmDialog('Xác nhận đã nhận hàng');
    await waitFor(() => expect(confirmReceipt).toHaveBeenCalledTimes(1));

    const cancel = (reason: string) => {
      fireEvent.click(screen.getByRole('button', { name: 'Hủy đơn' }));
      fireEvent.change(within(openDialog()).getByRole('textbox', { hidden: true }), {
        target: { value: reason },
      });
      confirmDialog('Hủy đơn');
    };
    cancel('Buyer withdrew');
    await waitFor(() => expect(cancelOrder).toHaveBeenCalledTimes(1));
    cancel('Buyer changed the design');
    await waitFor(() => expect(cancelOrder).toHaveBeenCalledTimes(2));

    const receiptKey = confirmReceipt.mock.calls[0]?.[2]?.idempotencyKey;
    const firstCancel = cancelOrder.mock.calls[0]?.[3]?.idempotencyKey;
    const secondCancel = cancelOrder.mock.calls[1]?.[3]?.idempotencyKey;
    expect(receiptKey).toEqual(expect.any(String));
    expect(firstCancel).toEqual(expect.any(String));
    expect(firstCancel).not.toBe(receiptKey);
    expect(secondCancel).not.toBe(firstCancel);
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

  it('does not print the description when it only repeats the title (GH#477)', async () => {
    const make = (design: string) =>
      ({
        getRequest: vi.fn().mockResolvedValue({ ...request, design }),
        listOwnContributions: vi.fn().mockResolvedValue([]),
        priceHint: vi.fn().mockResolvedValue({ hint: null }),
      }) as unknown as QuotationClient;
    const first = renderVi(<LiveContributionWorkspace rfqId={id} client={make('  logo CUPS ')} />);
    await screen.findByRole('heading', { level: 1, name: 'Logo cups' });
    expect(screen.queryByText(/logo cups/i, { selector: 'p' })).toBeNull();
    first.unmount();
    renderVi(
      <LiveContributionWorkspace rfqId={id} client={make('Cốc in logo, đóng hộp 6 chiếc')} />,
    );
    await screen.findByRole('heading', { level: 1, name: 'Logo cups' });
    expect(screen.getByText('Cốc in logo, đóng hộp 6 chiếc')).toBeTruthy();
  });

  it('shows an empty state, not an error, while a request has no allocations yet', async () => {
    const client = { listAllocations: vi.fn().mockResolvedValue([]) } as unknown as QuotationClient;
    renderVi(<LiveAllocationWorkspace rfqId={id} client={client} />);
    expect(await screen.findByText('Chưa có phân bổ nào cho đơn này.')).toBeTruthy();
    expect(screen.queryByText('Không tải được phân bổ.')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Thử lại' })).toBeNull();
  });
});
