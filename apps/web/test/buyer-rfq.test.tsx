import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { QuotationApiError, type QuotationClient } from '@vcraft/api-client';
import type { BuyerQuotationDto, RfqListItemDto, RfqResponse } from '@vcraft/contracts';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BuyerRfqDetail } from '@/features/rfq/buyer-rfq-detail';
import { BuyerRfqList } from '@/features/rfq/buyer-rfq-list';
import { DuplicateRequestButton } from '@/features/rfq/duplicate-request-button';
import { RfqForm } from '@/features/rfq/rfq-form';
import {
  EMPTY_RFQ_FORM,
  type RfqFormValues,
  rfqFormPayload,
  rfqFormProblems,
} from '@/features/rfq/rfq-form-model';
import { confirmDialog, openDialog } from './confirm';
import { renderVi } from './render';

const push = vi.fn();
vi.mock('@/i18n/navigation', () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a href="/x">{children}</a>,
  useRouter: () => ({ push }),
}));

const ID = '123e4567-e89b-12d3-a456-426614174000';
const REQUEST: RfqResponse = {
  id: ID,
  version: 4,
  revision: 1,
  status: 'BIDDING',
  title: 'Logo cups',
  category: 'TABLEWARE',
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
  invitedHouseholdIds: [],
  coordinationOptIn: true,
};
const quotation = (id: string, totalVnd: number): BuyerQuotationDto =>
  ({
    id,
    version: 1,
    status: 'SUBMITTED',
    quantity: 100,
    parts: [
      {
        householdId: ID,
        householdName: `Household ${id}`,
        quantity: 100,
        completionDate: '2100-01-01T00:00:00.000Z',
      },
    ],
    productionTotalVnd: totalVnd,
    additionalChargeVnd: 0,
    totalVnd,
    deliveryTerms: 'INCLUDED',
  }) as BuyerQuotationDto;

function client(overrides: Partial<QuotationClient> = {}): QuotationClient {
  return {
    getRequest: vi.fn().mockResolvedValue(REQUEST),
    listBuyerQuotations: vi.fn().mockResolvedValue([]),
    listAllocations: vi.fn().mockResolvedValue([]),
    listNotices: vi.fn().mockResolvedValue([]),
    recordConsent: vi.fn().mockResolvedValue({}),
    ...overrides,
  } as unknown as QuotationClient;
}

const VALID: RfqFormValues = {
  ...EMPTY_RFQ_FORM,
  title: 'Logo cups',
  category: 'TABLEWARE',
  description: 'Cups',
  quantity: '100',
  unit: 'cup',
  deadline: '2099-12-01',
  requiredBy: '2100-02-01',
  destination: 'Hanoi',
};

describe('rfq form rules', () => {
  const now = new Date('2099-01-01T00:00:00.000Z');

  it('accepts a complete form and converts dates to the end of that Vietnam day', () => {
    expect(rfqFormProblems(VALID, now)).toEqual({});
    expect(rfqFormPayload(VALID)).toMatchObject({
      quantity: 100,
      biddingClosesAt: '2099-12-01T16:59:59.000Z',
      coordinationOptIn: true,
      invitedHouseholdIds: [],
    });
  });

  it('reports each required field on an empty form', () => {
    expect(Object.keys(rfqFormProblems(EMPTY_RFQ_FORM, now)).sort()).toEqual(
      [
        'category',
        'deadline',
        'description',
        'destination',
        'quantity',
        'requiredBy',
        'title',
        'unit',
      ].sort(),
    );
  });

  it('requires a deadline 24 hours away, delivery after it and an ordered budget', () => {
    expect(rfqFormProblems({ ...VALID, deadline: '2098-12-31' }, now).deadline).toBe(true);
    expect(rfqFormProblems({ ...VALID, requiredBy: '2099-12-01' }, now).requiredBy).toBe(true);
    expect(rfqFormProblems({ ...VALID, budgetMin: '5', budgetMax: '1' }, now).budget).toBe(true);
    expect(rfqFormProblems({ ...VALID, budgetMin: 'abc' }, now).budget).toBe(true);
    // Nobody chosen and no coordination is fine: the system matches households of the category (BR-05).
    expect(rfqFormProblems({ ...VALID, coordinate: false }, now)).toEqual({});
  });
});

describe('RfqForm', () => {
  beforeEach(() => {
    window.localStorage.clear();
    push.mockClear();
  });

  const fill = async () => {
    const type = (label: string, value: string) =>
      fireEvent.change(screen.getByLabelText(label), { target: { value } });
    type('Tiêu đề', 'Logo cups');
    fireEvent.change(screen.getByLabelText('Danh mục'), { target: { value: 'TABLEWARE' } });
    type('Mô tả', 'Cups');
    type('Số lượng', '100');
    type('Đơn vị', 'cup');
    type('Hạn chào giá', '2099-12-01');
    type('Ngày cần hàng', '2100-02-01');
    type('Nơi giao hàng', 'Hanoi');
    fireEvent.click(screen.getByRole('checkbox', { name: /Chính sách quyền riêng tư/ }));
  };

  it('keeps an unfinished form in the browser and restores it', async () => {
    const api = client();
    const { unmount } = renderVi(<RfqForm client={api} />);
    fireEvent.change(await screen.findByLabelText('Tiêu đề'), { target: { value: 'Half done' } });
    expect(
      await screen.findByText('Đã lưu tạm trên trình duyệt này', {}, { timeout: 2000 }),
    ).toBeTruthy();
    expect(api.createRequest).toBeUndefined();
    unmount();
    renderVi(<RfqForm client={api} />);
    await waitFor(() =>
      expect((screen.getByLabelText('Tiêu đề') as HTMLInputElement).value).toBe('Half done'),
    );
  });

  it('seeds a new form from a product prefill and ignores a browser-kept draft', async () => {
    window.localStorage.setItem(
      'vcraft.rfq-draft',
      JSON.stringify({ id: null, values: { ...EMPTY_RFQ_FORM, title: 'Old draft' } }),
    );
    renderVi(
      <RfqForm
        client={client()}
        prefill={{
          title: 'Bình hoa men lam',
          category: 'VASE',
          description: 'Quan tâm đến mã BT7K2QXM',
        }}
      />,
    );
    await waitFor(() =>
      expect((screen.getByLabelText('Tiêu đề') as HTMLInputElement).value).toBe('Bình hoa men lam'),
    );
    expect((screen.getByLabelText('Danh mục') as HTMLSelectElement).value).toBe('VASE');
    expect((screen.getByLabelText('Mô tả') as HTMLTextAreaElement).value).toBe(
      'Quan tâm đến mã BT7K2QXM',
    );
  });

  it('saves a complete form as a server draft, then updates it with the returned version', async () => {
    const createRequest = vi.fn().mockResolvedValue({ ...REQUEST, status: 'DRAFT', version: 1 });
    const updateRequest = vi.fn().mockResolvedValue({ ...REQUEST, status: 'DRAFT', version: 2 });
    const recordConsent = vi.fn().mockResolvedValue({});
    renderVi(<RfqForm client={client({ createRequest, updateRequest, recordConsent })} />);
    await fill();
    await waitFor(() => expect(createRequest).toHaveBeenCalledTimes(1), { timeout: 2000 });
    // Consent is recorded server-side once, before the first save of the address.
    expect(recordConsent).toHaveBeenCalledTimes(1);
    expect(recordConsent).toHaveBeenCalledWith('RFQ_CONTACT', '2026-11-01');
    expect(recordConsent.mock.invocationCallOrder[0]).toBeLessThan(
      createRequest.mock.invocationCallOrder[0] ?? 0,
    );
    expect(await screen.findByText('Đã lưu nháp')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Đơn vị'), { target: { value: 'set' } });
    await waitFor(() => expect(updateRequest).toHaveBeenCalled(), { timeout: 2000 });
    expect(updateRequest).toHaveBeenCalledWith(ID, 1, expect.objectContaining({ unit: 'set' }));
  });

  it('does not send, or save the address to the server, before the buyer consents', async () => {
    const createRequest = vi.fn();
    const submitRequest = vi.fn();
    const recordConsent = vi.fn();
    renderVi(<RfqForm client={client({ createRequest, submitRequest, recordConsent })} />);
    await fill();
    fireEvent.click(screen.getByRole('checkbox', { name: /Chính sách quyền riêng tư/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Gửi yêu cầu' }));
    expect(await screen.findByText(/Hãy đồng ý với chính sách quyền riêng tư/)).toBeTruthy();
    await new Promise((resolve) => setTimeout(resolve, 1000));
    expect(createRequest).not.toHaveBeenCalled();
    expect(recordConsent).not.toHaveBeenCalled();
    expect(submitRequest).not.toHaveBeenCalled();
  });

  it('shows what is missing instead of sending an incomplete form', async () => {
    const submitRequest = vi.fn();
    renderVi(<RfqForm client={client({ submitRequest })} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Gửi yêu cầu' }));
    expect(await screen.findByText('Hãy nhập tiêu đề.')).toBeTruthy();
    expect(submitRequest).not.toHaveBeenCalled();
  });

  it('reuses a failed RFQ creation key and replaces it after an input change', async () => {
    const createRequest = vi
      .fn<QuotationClient['createRequest']>()
      .mockRejectedValue(new TypeError('Timeout'));
    renderVi(<RfqForm client={client({ createRequest })} />);
    await fill();
    const send = () => fireEvent.click(screen.getByRole('button', { name: 'Gửi yêu cầu' }));
    send();
    await screen.findByRole('alert');
    send();
    await waitFor(() => expect(createRequest).toHaveBeenCalledTimes(2));
    const first = createRequest.mock.calls[0]?.[1]?.idempotencyKey;
    expect(first).toEqual(expect.any(String));
    expect(createRequest.mock.calls[1]?.[1]?.idempotencyKey).toBe(first);
    fireEvent.change(screen.getByLabelText('Số lượng'), { target: { value: '200' } });
    send();
    await waitFor(() => expect(createRequest).toHaveBeenCalledTimes(3));
    expect(createRequest.mock.calls[2]?.[1]?.idempotencyKey).not.toBe(first);
  });

  it('retries RFQ submission with the same key and version without saving the draft again', async () => {
    const createRequest = vi.fn().mockResolvedValue({ ...REQUEST, status: 'DRAFT', version: 7 });
    const updateRequest = vi.fn().mockResolvedValue({ ...REQUEST, status: 'DRAFT', version: 8 });
    const submitRequest = vi
      .fn<QuotationClient['submitRequest']>()
      .mockRejectedValueOnce(new TypeError('Timeout'))
      .mockResolvedValue({ ...REQUEST, status: 'SENT', version: 8 });
    renderVi(<RfqForm client={client({ createRequest, updateRequest, submitRequest })} />);
    await fill();
    fireEvent.click(screen.getByRole('button', { name: 'Gửi yêu cầu' }));
    await screen.findByRole('alert');
    fireEvent.click(screen.getByRole('button', { name: 'Gửi yêu cầu' }));
    await waitFor(() => expect(submitRequest).toHaveBeenCalledTimes(2));
    const first = submitRequest.mock.calls[0];
    expect(first?.[2]?.idempotencyKey).toEqual(expect.any(String));
    expect(submitRequest.mock.calls[1]).toEqual(first);
    expect(updateRequest).not.toHaveBeenCalled();
  });

  it('sends with the saved version, clears the kept draft and opens the request', async () => {
    const createRequest = vi.fn().mockResolvedValue({ ...REQUEST, status: 'DRAFT', version: 7 });
    const submitRequest = vi.fn().mockResolvedValue({ ...REQUEST, status: 'SENT', version: 8 });
    renderVi(<RfqForm client={client({ createRequest, submitRequest })} />);
    await fill();
    fireEvent.click(screen.getByRole('button', { name: 'Gửi yêu cầu' }));
    await waitFor(() =>
      expect(submitRequest).toHaveBeenCalledWith(ID, 7, { idempotencyKey: expect.any(String) }),
    );
    await waitFor(() =>
      expect(push).toHaveBeenCalledWith({
        pathname: '/yeu-cau-bao-gia/[code]',
        params: { code: ID },
      }),
    );
    expect(window.localStorage.getItem('vcraft.rfq-draft')).toBeNull();
  });
});

describe('DuplicateRequestButton', () => {
  it('reuses the request duplication key after a timeout', async () => {
    const duplicateRequest = vi
      .fn<QuotationClient['duplicateRequest']>()
      .mockRejectedValueOnce(new TypeError('Timeout'))
      .mockResolvedValue({ ...REQUEST, status: 'DRAFT' });
    renderVi(<DuplicateRequestButton requestId={ID} client={client({ duplicateRequest })} />);
    const button = screen.getByRole('button');
    fireEvent.click(button);
    await screen.findByRole('alert');
    fireEvent.click(button);
    await waitFor(() => expect(duplicateRequest).toHaveBeenCalledTimes(2));
    const first = duplicateRequest.mock.calls[0]?.[1]?.idempotencyKey;
    expect(first).toEqual(expect.any(String));
    expect(duplicateRequest.mock.calls[1]?.[1]?.idempotencyKey).toBe(first);
  });
});

describe('BuyerRfqList', () => {
  const ROW: RfqListItemDto = { ...REQUEST, openQuotationCount: 2 };

  it('reads the API, passes the status filter and pages with the cursor', async () => {
    const listRequests = vi
      .fn()
      .mockResolvedValueOnce({ data: [ROW], nextCursor: 'next' })
      .mockResolvedValueOnce({
        data: [{ ...ROW, id: `${ID}x`, title: 'Second' }],
        nextCursor: null,
      })
      .mockResolvedValue({ data: [], nextCursor: null });
    renderVi(<BuyerRfqList client={client({ listRequests })} />);

    expect(await screen.findByText('Logo cups')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Xem thêm' }));
    expect(await screen.findByText('Second')).toBeTruthy();
    expect(listRequests).toHaveBeenLastCalledWith({ cursor: 'next' });

    fireEvent.change(screen.getByLabelText('Trạng thái'), { target: { value: 'ACCEPTED' } });
    await waitFor(() => expect(listRequests).toHaveBeenLastCalledWith({ status: 'ACCEPTED' }));
  });

  it('asks a signed-out buyer to sign in', async () => {
    const listRequests = vi
      .fn()
      .mockRejectedValue(new QuotationApiError('AUTH_UNAUTHENTICATED', 401));
    renderVi(<BuyerRfqList client={client({ listRequests })} />);
    expect(await screen.findByText(/Đăng nhập bằng tài khoản người mua/)).toBeTruthy();
  });
});

describe('BuyerRfqDetail', () => {
  beforeEach(() => {
    HTMLDialogElement.prototype.showModal ??= vi.fn();
    HTMLDialogElement.prototype.close ??= vi.fn();
  });

  it('reuses the accept quotation key after a client timeout', async () => {
    const acceptQuotation = vi
      .fn<QuotationClient['acceptQuotation']>()
      .mockRejectedValueOnce(new TypeError('Timeout'))
      .mockResolvedValue({ ...REQUEST, status: 'ACCEPTED' });
    renderVi(
      <BuyerRfqDetail
        rfqId={ID}
        client={client({
          listBuyerQuotations: vi.fn().mockResolvedValue([quotation('a', 3_000_000)]),
          acceptQuotation,
        })}
      />,
    );
    await screen.findByText('Household a');
    fireEvent.click(screen.getByRole('button', { name: 'Chốt chào giá này' }));
    confirmDialog('Chốt chào giá này');
    await waitFor(() => expect(within(openDialog()).getByRole('alert')).toBeTruthy());
    confirmDialog('Chốt chào giá này');
    await waitFor(() => expect(acceptQuotation).toHaveBeenCalledTimes(2));
    const first = acceptQuotation.mock.calls[0]?.[3]?.idempotencyKey;
    expect(first).toEqual(expect.any(String));
    expect(acceptQuotation.mock.calls[1]?.[3]?.idempotencyKey).toBe(first);
  });

  it('compares quotations, marks the lowest total and accepts with the current version', async () => {
    const acceptQuotation = vi.fn().mockResolvedValue({ ...REQUEST, status: 'ACCEPTED' });
    renderVi(
      <BuyerRfqDetail
        rfqId={ID}
        client={client({
          listBuyerQuotations: vi
            .fn()
            .mockResolvedValue([quotation('a', 3_000_000), quotation('b', 2_000_000)]),
          acceptQuotation,
        })}
      />,
    );
    expect(await screen.findByText('Household a')).toBeTruthy();
    expect(screen.getAllByText('Tổng thấp nhất')).toHaveLength(1);
    fireEvent.click(
      screen.getAllByRole('button', { name: 'Chốt chào giá này', hidden: true })[0] as HTMLElement,
    );
    const dialog = (await screen.findByText('Chốt chào giá này?')).closest('dialog') as HTMLElement;
    const confirm = Array.from(dialog.querySelectorAll('button')).find(
      (button) => button.textContent === 'Chốt chào giá này',
    ) as HTMLElement;
    await act(async () => {
      fireEvent.click(confirm);
    });
    expect(acceptQuotation).toHaveBeenCalledWith(
      ID,
      4,
      { quotationId: 'a' },
      { idempotencyKey: expect.any(String) },
    );
  });

  it('closes the accept dialog with "Yêu cầu đã được chốt" when the other session accepted first (AC-2)', async () => {
    const acceptQuotation = vi.fn().mockRejectedValue(new QuotationApiError('STALE_VERSION', 409));
    const getRequest = vi
      .fn()
      .mockResolvedValueOnce(REQUEST)
      .mockResolvedValue({ ...REQUEST, status: 'ACCEPTED', version: 5 });
    renderVi(
      <BuyerRfqDetail
        rfqId={ID}
        client={client({
          getRequest,
          listBuyerQuotations: vi.fn().mockResolvedValue([quotation('a', 3_000_000)]),
          acceptQuotation,
        })}
      />,
    );
    await screen.findByText('Household a');
    fireEvent.click(
      screen.getAllByRole('button', { name: 'Chốt chào giá này', hidden: true })[0] as HTMLElement,
    );
    await screen.findByText('Chốt chào giá này?');
    await act(async () => {
      confirmDialog('Chốt chào giá này');
    });
    await waitFor(() => expect(document.querySelector('dialog[open]')).toBeNull());
    expect((await screen.findByRole('alert')).textContent).toBe('Yêu cầu đã được chốt');
    expect(screen.queryByText(/vừa được cập nhật/)).toBeNull();
  });

  it('keeps the accept dialog open with the stale message while the request is still open', async () => {
    const acceptQuotation = vi.fn().mockRejectedValue(new QuotationApiError('STALE_VERSION', 409));
    renderVi(
      <BuyerRfqDetail
        rfqId={ID}
        client={client({
          getRequest: vi.fn().mockResolvedValue({ ...REQUEST, version: 5 }),
          listBuyerQuotations: vi.fn().mockResolvedValue([quotation('a', 3_000_000)]),
          acceptQuotation,
        })}
      />,
    );
    await screen.findByText('Household a');
    fireEvent.click(
      screen.getAllByRole('button', { name: 'Chốt chào giá này', hidden: true })[0] as HTMLElement,
    );
    await screen.findByText('Chốt chào giá này?');
    await act(async () => {
      confirmDialog('Chốt chào giá này');
    });
    expect(within(openDialog()).getByRole('alert').textContent).toContain(
      'Dữ liệu vừa được cập nhật',
    );
    expect(document.querySelector('dialog[open]')).toBeTruthy();
  });

  it('a bid lands on the table: best total glows, amounts are readable, the accepted offer is sealed (GH#175)', async () => {
    const accepted = { ...quotation('a', 2_000_000), status: 'ACCEPTED' } as BuyerQuotationDto;
    const listBuyerQuotations = vi
      .fn()
      .mockResolvedValueOnce([quotation('a', 2_000_000), quotation('b', 3_000_000)])
      .mockResolvedValue([accepted, { ...quotation('b', 3_000_000), status: 'REJECTED' }]);
    const acceptQuotation = vi.fn().mockResolvedValue({ ...REQUEST, status: 'ACCEPTED' });
    const getRequest = vi
      .fn()
      .mockResolvedValueOnce(REQUEST)
      .mockResolvedValue({ ...REQUEST, status: 'ACCEPTED', version: 5 });
    const { container } = renderVi(
      <BuyerRfqDetail
        rfqId={ID}
        client={client({ getRequest, listBuyerQuotations, acceptQuotation })}
      />,
    );
    expect(await screen.findByText('Household a')).toBeTruthy();
    const best = container.querySelectorAll('[data-best]');
    expect(best).toHaveLength(1);
    expect(best[0]?.className).toContain('bid-best');
    // The counting digits are hidden from screen readers; the final amount is always in the text.
    expect(best[0]?.querySelector('.sr-only')?.textContent).toMatch(/2\.000\.000/);

    fireEvent.click(
      screen.getAllByRole('button', { name: 'Chốt chào giá này', hidden: true })[0] as HTMLElement,
    );
    const dialog = (await screen.findByText('Chốt chào giá này?')).closest('dialog') as HTMLElement;
    const confirm = Array.from(dialog.querySelectorAll('button')).find(
      (button) => button.textContent === 'Chốt chào giá này',
    ) as HTMLElement;
    await act(async () => {
      fireEvent.click(confirm);
    });
    await waitFor(() => expect(container.querySelector('.seal-stamp')).toBeTruthy());
    expect(container.querySelector('.animate-stamp-shake')).toBeTruthy();
  });

  it('requires a reason before cancelling', async () => {
    const cancelOrder = vi.fn().mockResolvedValue({ ...REQUEST, status: 'CANCELLED' });
    renderVi(<BuyerRfqDetail rfqId={ID} client={client({ cancelOrder })} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Hủy yêu cầu' }));
    const area = screen.getByLabelText('Lý do hủy', { selector: 'textarea' });
    const dialog = area.closest('dialog') as HTMLElement;
    const confirm = Array.from(dialog.querySelectorAll('button')).find(
      (button) => button.textContent === 'Hủy yêu cầu',
    ) as HTMLElement;
    fireEvent.click(confirm);
    expect(await screen.findByText('Hãy ghi lý do.')).toBeTruthy();
    expect(cancelOrder).not.toHaveBeenCalled();
    fireEvent.change(area, { target: { value: 'Plans changed' } });
    await act(async () => {
      fireEvent.click(confirm);
    });
    expect(cancelOrder).toHaveBeenCalledWith(
      ID,
      4,
      { reason: 'Plans changed' },
      { idempotencyKey: expect.any(String) },
    );
  });

  it.each([
    ['DELIVERED', false],
    ['EXPIRED', false],
    ['IN_PRODUCTION', false],
    ['SENT', true],
  ] as const)(
    'on %s shows cancel: %s, and never accept without a quotation',
    async (status, can) => {
      renderVi(
        <BuyerRfqDetail
          rfqId={ID}
          client={client({ getRequest: vi.fn().mockResolvedValue({ ...REQUEST, status }) })}
        />,
      );
      await screen.findByRole('heading', { name: 'Logo cups' });
      await waitFor(() => expect(screen.getByTestId('quotation-comparison')).toBeTruthy());
      expect(screen.queryByRole('button', { name: 'Hủy yêu cầu' }) !== null).toBe(can);
      expect(screen.queryByRole('button', { name: 'Chốt chào giá này' })).toBeNull();
    },
  );

  it('shows the empty allocation state for an accepted order with no timeline data', async () => {
    renderVi(
      <BuyerRfqDetail
        rfqId={ID}
        client={client({
          getRequest: vi.fn().mockResolvedValue({ ...REQUEST, status: 'ACCEPTED' }),
        })}
      />,
    );
    expect(await screen.findByText('Chưa có phân bổ.')).toBeTruthy();
    expect(screen.queryByRole('progressbar')).toBeNull();
  });

  it('offers receipt only when every allocation is done', async () => {
    const allocation = (status: string) => ({
      id: ID,
      version: 1,
      householdId: ID,
      householdName: 'Gốm Minh Hải',
      startedAt: '2099-01-01T00:00:00Z',
      dueAt: '2100-01-01T00:00:00Z',
      lateness: 'DONE',
      expectedQty: 100,
      progressPercent: 100,
      quantity: 100,
      completedQty: 100,
      status,
    });
    const getRequest = vi.fn().mockResolvedValue({ ...REQUEST, status: 'IN_PRODUCTION' });
    const { unmount } = renderVi(
      <BuyerRfqDetail
        rfqId={ID}
        client={client({
          getRequest,
          listAllocations: vi.fn().mockResolvedValue([allocation('IN_PROGRESS')]),
        })}
      />,
    );
    await screen.findByText('Đang tiến hành', {}, { timeout: 1000 }).catch(() => undefined);
    await screen.findByRole('heading', { name: 'Logo cups' });
    expect(screen.queryByRole('button', { name: 'Xác nhận đã nhận hàng' })).toBeNull();
    unmount();
    renderVi(
      <BuyerRfqDetail
        rfqId={ID}
        client={client({
          getRequest,
          listAllocations: vi.fn().mockResolvedValue([allocation('DONE')]),
        })}
      />,
    );
    expect(await screen.findByRole('button', { name: 'Xác nhận đã nhận hàng' })).toBeTruthy();
  });

  it('offers receipt when cancelled and reallocated-declined shares sit next to done ones', async () => {
    const allocation = (status: string, quantity: number) => ({
      id: ID,
      version: 1,
      householdId: ID,
      householdName: 'Gốm Minh Hải',
      startedAt: '2099-01-01T00:00:00Z',
      dueAt: '2100-01-01T00:00:00Z',
      lateness: 'DONE',
      expectedQty: quantity,
      progressPercent: 100,
      quantity,
      completedQty: quantity,
      status,
    });
    renderVi(
      <BuyerRfqDetail
        rfqId={ID}
        client={client({
          getRequest: vi.fn().mockResolvedValue({ ...REQUEST, status: 'IN_PRODUCTION' }),
          listAllocations: vi
            .fn()
            .mockResolvedValue([
              allocation('DONE', 60),
              allocation('DONE', 40),
              allocation('CANCELLED', 30),
              allocation('DECLINED', 0),
            ]),
        })}
      />,
    );
    expect(await screen.findByRole('button', { name: 'Xác nhận đã nhận hàng' })).toBeTruthy();
  });

  it('duplicates a delivered request and opens the fresh draft for review', async () => {
    const duplicateRequest = vi
      .fn()
      .mockResolvedValue({ ...REQUEST, id: 'copy-id', status: 'DRAFT' });
    renderVi(
      <BuyerRfqDetail
        rfqId={ID}
        client={client({
          getRequest: vi.fn().mockResolvedValue({ ...REQUEST, status: 'DELIVERED' }),
          duplicateRequest,
        })}
      />,
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Nhân bản thành bản nháp' }));
    await waitFor(() =>
      expect(push).toHaveBeenCalledWith({
        pathname: '/yeu-cau-bao-gia/[code]',
        params: { code: 'copy-id' },
      }),
    );
    expect(duplicateRequest).toHaveBeenCalledWith(ID, { idempotencyKey: expect.any(String) });
  });

  it('continues a draft in the form and shows a cancelled request with its reason', async () => {
    const { unmount } = renderVi(
      <BuyerRfqDetail
        rfqId={ID}
        client={client({ getRequest: vi.fn().mockResolvedValue({ ...REQUEST, status: 'DRAFT' }) })}
      />,
    );
    await waitFor(() =>
      expect((screen.getByLabelText('Tiêu đề') as HTMLInputElement).value).toBe('Logo cups'),
    );
    unmount();
    renderVi(
      <BuyerRfqDetail
        rfqId={ID}
        client={client({
          getRequest: vi
            .fn()
            .mockResolvedValue({ ...REQUEST, status: 'CANCELLED', cancelReason: 'Plans changed' }),
        })}
      />,
    );
    expect(await screen.findByText(/Plans changed/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Hủy yêu cầu' })).toBeNull();
  });
});
