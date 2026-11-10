import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { QuotationApiError, type QuotationClient } from '@vcraft/api-client';
import type {
  BuyerQuotationDto,
  DirectQuotationDto,
  MyInvitationDto,
  RfqResponse,
} from '@vcraft/contracts';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BuyerRfqDetail } from '@/features/rfq/buyer-rfq-detail';
import { LiveContributionWorkspace } from '@/features/rfq/live-contribution-workspace';
import { RfqForm } from '@/features/rfq/rfq-form';
import {
  EMPTY_RFQ_FORM,
  type RfqAttachmentValue,
  rfqFormPayload,
  rfqFormProblems,
  rfqFormValues,
} from '@/features/rfq/rfq-form-model';
import { QuotationInvitations } from '@/features/studio/quotation-invitations';
import { confirmDialog } from './confirm';
import { renderVi } from './render';

vi.mock('@/i18n/navigation', () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a href="/x">{children}</a>,
  useRouter: () => ({ push }),
}));
const push = vi.hoisted(() => vi.fn());
const notifySuccess = vi.hoisted(() => vi.fn());
vi.mock('@/lib/notify', () => ({
  notify: { success: notifySuccess, error: vi.fn(), info: vi.fn() },
}));

const ID = '123e4567-e89b-12d3-a456-426614174000';
const REQUEST: RfqResponse = {
  id: ID,
  version: 4,
  revision: 1,
  status: 'SENT',
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
  invitedHouseholdIds: [ID],
  coordinationOptIn: false,
  declinedByMe: false,
};
const QUOTATION: DirectQuotationDto = {
  id: ID,
  version: 3,
  status: 'SUBMITTED',
  quantity: 100,
  unitPriceVnd: 30_000,
  totalVnd: 3_000_000,
  completionDate: '2100-01-01T00:00:00.000Z',
  note: null,
};
const asClient = (methods: object) => methods as unknown as QuotationClient;

describe('request form model (FR-RFQ-01, BR-05)', () => {
  const VALID = {
    ...EMPTY_RFQ_FORM,
    title: 'Logo cups',
    category: 'TABLEWARE' as const,
    description: 'Cups',
    quantity: '100',
    unit: 'cup',
    deadline: '2099-12-01',
    requiredBy: '2100-02-01',
    destination: 'Hanoi',
    coordinate: false,
  };
  const now = new Date('2099-01-01T00:00:00.000Z');

  it('lets a request with no chosen household and no coordination go: the system matches', () => {
    expect(rfqFormProblems(VALID, now)).toEqual({});
    expect(rfqFormPayload(VALID)).toMatchObject({
      invitedHouseholdIds: [],
      coordinationOptIn: false,
      attachments: [],
    });
  });

  it('sends trimmed custom requirements and the attachment ids, and omits empty requirements', () => {
    const file: RfqAttachmentValue = {
      id: ID,
      name: 'logo.png',
      mimeType: 'image/png',
      sizeBytes: 10,
    };
    const payload = rfqFormPayload({
      ...VALID,
      customRequirements: '  Print the logo  ',
      attachments: [file],
    });
    expect(payload.customRequirements).toBe('Print the logo');
    expect(payload.attachments).toEqual([ID]);
    expect('customRequirements' in rfqFormPayload(VALID)).toBe(false);
  });

  it('reads requirements and attachments back from a saved request', () => {
    const values = rfqFormValues({
      ...REQUEST,
      customRequirements: 'Gift wrap',
      attachments: [{ id: ID, mimeType: 'application/pdf', sizeBytes: 2048 }],
    });
    expect(values.customRequirements).toBe('Gift wrap');
    expect(values.attachments).toEqual([
      { id: ID, name: '', mimeType: 'application/pdf', sizeBytes: 2048 },
    ]);
  });
});

describe('RfqForm requirements, attachments and matching', () => {
  beforeEach(() => {
    window.localStorage.clear();
    push.mockClear();
    notifySuccess.mockClear();
  });

  const fill = () => {
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
  const api = (overrides: object = {}) =>
    asClient({
      getRequest: vi.fn(),
      recordConsent: vi.fn().mockResolvedValue({}),
      listHouseholds: vi.fn().mockResolvedValue({ data: [] }),
      createRequest: vi.fn().mockResolvedValue({ ...REQUEST, status: 'DRAFT', version: 1 }),
      updateRequest: vi.fn().mockResolvedValue({ ...REQUEST, status: 'DRAFT', version: 2 }),
      submitRequest: vi.fn().mockResolvedValue({
        ...REQUEST,
        status: 'SENT',
        version: 3,
        invitedHouseholdIds: [ID, `${ID}1`, `${ID}2`],
      }),
      ...overrides,
    });

  it('saves the requirements and attached files with the draft', async () => {
    const createRequest = vi.fn().mockResolvedValue({ ...REQUEST, status: 'DRAFT', version: 1 });
    const upload = vi.fn(
      async (file: File): Promise<RfqAttachmentValue> => ({
        id: ID,
        name: file.name,
        mimeType: file.type,
        sizeBytes: file.size,
      }),
    );
    renderVi(<RfqForm client={api({ createRequest })} upload={upload} />);
    await screen.findByLabelText('Tiêu đề');
    fireEvent.change(screen.getByLabelText(/Yêu cầu riêng/), {
      target: { value: 'Print our logo' },
    });
    const picker = screen.getByLabelText('Tệp đính kèm (không bắt buộc)', { selector: 'input' });
    fireEvent.change(picker, {
      target: { files: [new File(['x'], 'logo.png', { type: 'image/png' })] },
    });
    expect(await screen.findByText('logo.png')).toBeTruthy();
    fill();
    await waitFor(() => expect(createRequest).toHaveBeenCalledTimes(1), { timeout: 3000 });
    expect(createRequest).toHaveBeenCalledWith(
      expect.objectContaining({ customRequirements: 'Print our logo', attachments: [ID] }),
      { idempotencyKey: expect.any(String) },
    );
  });

  it('refuses a file of the wrong type or size without uploading it, and stops at three files', async () => {
    const upload = vi.fn(
      async (file: File): Promise<RfqAttachmentValue> => ({
        id: `${ID}${file.name}`,
        name: file.name,
        mimeType: file.type,
        sizeBytes: file.size,
      }),
    );
    renderVi(<RfqForm client={api()} upload={upload} />);
    await screen.findByLabelText('Tiêu đề');
    const picker = screen.getByLabelText('Tệp đính kèm (không bắt buộc)', { selector: 'input' });
    fireEvent.change(picker, {
      target: { files: [new File(['x'], 'notes.txt', { type: 'text/plain' })] },
    });
    expect(await screen.findByText('Chỉ nhận ảnh JPEG, PNG, WebP, AVIF hoặc PDF.')).toBeTruthy();
    const huge = new File(['x'], 'big.png', { type: 'image/png' });
    Object.defineProperty(huge, 'size', { value: 16 * 1024 * 1024 });
    fireEvent.change(picker, { target: { files: [huge] } });
    expect(await screen.findByText('Tệp quá lớn, tối đa 15 MB.')).toBeTruthy();
    expect(upload).not.toHaveBeenCalled();

    fireEvent.change(picker, {
      target: {
        files: ['a', 'b', 'c', 'd'].map(
          (name) => new File([name], `${name}.png`, { type: 'image/png' }),
        ),
      },
    });
    expect(await screen.findByText('Đã đủ 3 tệp.')).toBeTruthy();
    expect(upload).toHaveBeenCalledTimes(3);
    expect((picker as HTMLInputElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Bỏ tệp a.png' }));
    await waitFor(() => expect((picker as HTMLInputElement).disabled).toBe(false));
  });

  it('says how many matching households the request went to', async () => {
    const submitRequest = vi.fn().mockResolvedValue({
      ...REQUEST,
      status: 'SENT',
      invitedHouseholdIds: [ID, `${ID}1`, `${ID}2`],
    });
    renderVi(<RfqForm client={api({ submitRequest })} />);
    await screen.findByLabelText('Tiêu đề');
    fill();
    // No coordination and no household ticked: the system picks the households.
    fireEvent.click(screen.getByRole('checkbox', { name: /Nhờ Ban quản lý làng điều phối/ }));
    expect(
      screen.getByText(/Để trống, hệ thống sẽ tự mời tối đa 10 hộ đang làm cùng danh mục/),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Gửi yêu cầu' }));
    await waitFor(() => expect(submitRequest).toHaveBeenCalled());
    await waitFor(() =>
      expect(notifySuccess).toHaveBeenCalledWith('Đã gửi yêu cầu báo giá tới 3 hộ phù hợp.'),
    );
  });

  it('explains when no household of the category could be invited', async () => {
    const submitRequest = vi
      .fn()
      .mockRejectedValue(new QuotationApiError('RFQ_NO_MATCHING_HOUSEHOLD', 422));
    renderVi(<RfqForm client={api({ submitRequest })} />);
    await screen.findByLabelText('Tiêu đề');
    fill();
    fireEvent.click(screen.getByRole('button', { name: 'Gửi yêu cầu' }));
    expect(await screen.findByText(/Chưa có hộ nào làm danh mục này để mời/)).toBeTruthy();
    expect(push).not.toHaveBeenCalled();
  });
});

describe('BuyerRfqDetail with household quotations', () => {
  beforeEach(() => {
    HTMLDialogElement.prototype.showModal ??= vi.fn();
    HTMLDialogElement.prototype.close ??= vi.fn();
  });

  const direct = (id: string, name: string, unitPriceVnd: number, note: string | null) =>
    ({
      id,
      version: 1,
      status: 'SUBMITTED',
      bidType: 'INDIVIDUAL',
      note,
      quantity: 100,
      parts: [
        {
          householdId: ID,
          householdName: name,
          quantity: 100,
          unitPriceVnd,
          completionDate: '2100-01-01T00:00:00.000Z',
        },
      ],
      productionTotalVnd: unitPriceVnd * 100,
      additionalChargeVnd: 0,
      totalVnd: unitPriceVnd * 100,
      deliveryTerms: 'SEPARATE',
    }) as BuyerQuotationDto;

  const detail = (overrides: object = {}) =>
    asClient({
      getRequest: vi.fn().mockResolvedValue({
        ...REQUEST,
        status: 'BIDDING',
        invitedHouseholdIds: [ID, `${ID}1`],
        customRequirements: 'Print the logo in cobalt blue',
        attachments: [{ id: ID, mimeType: 'application/pdf', sizeBytes: 2048 }],
      }),
      listBuyerQuotations: vi
        .fn()
        .mockResolvedValue([
          direct('a', 'Gốm Minh Hải', 30_000, 'Fired twice'),
          direct('b', 'Gốm Bảo Anh', 28_000, null),
        ]),
      listAllocations: vi.fn().mockResolvedValue([]),
      listNotices: vi.fn().mockResolvedValue([]),
      ...overrides,
    });

  it('lists each household quotation with name, unit price, total and completion date', async () => {
    renderVi(<BuyerRfqDetail rfqId={ID} client={detail()} />);
    expect(await screen.findByText('Gốm Minh Hải')).toBeTruthy();
    expect(screen.getByText('Gốm Bảo Anh')).toBeTruthy();
    expect(screen.getAllByText('Hộ báo giá riêng')).toHaveLength(2);
    expect(screen.getByText(/30\.000\s*₫ một cup/)).toBeTruthy();
    expect(screen.getByText(/28\.000\s*₫ một cup/)).toBeTruthy();
    const comparison = screen.getByTestId('quotation-comparison');
    expect(within(comparison).getAllByText(/3\.000\.000/).length).toBeGreaterThan(0);
    expect(within(comparison).getAllByText(/2\.800\.000/).length).toBeGreaterThan(0);
    expect(screen.getByText('Ghi chú của hộ: Fired twice')).toBeTruthy();
    expect(screen.getAllByText('Tổng thấp nhất')).toHaveLength(1);
  });

  it('shows the requirements, the attachments and how many households were invited', async () => {
    const getMediaReadUrl = vi
      .fn()
      .mockResolvedValue({ url: 'https://files.test/a', expiresAt: 'x' });
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    renderVi(<BuyerRfqDetail rfqId={ID} client={detail({ getMediaReadUrl })} />);
    expect(await screen.findByText('Print the logo in cobalt blue')).toBeTruthy();
    expect(screen.getByText('Đã gửi tới 2 hộ phù hợp.')).toBeTruthy();
    expect(screen.getByText(/Tệp đính kèm 1/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Mở' }));
    await waitFor(() => expect(getMediaReadUrl).toHaveBeenCalledWith(ID));
    expect(open).toHaveBeenCalledWith('https://files.test/a', '_blank', 'noopener,noreferrer');
    open.mockRestore();
  });

  it('accepts the chosen household quotation with the current request version', async () => {
    const acceptQuotation = vi.fn().mockResolvedValue({ ...REQUEST, status: 'ACCEPTED' });
    renderVi(<BuyerRfqDetail rfqId={ID} client={detail({ acceptQuotation })} />);
    await screen.findByText('Gốm Bảo Anh');
    fireEvent.click(
      screen.getAllByRole('button', { name: 'Chốt chào giá này', hidden: true })[1] as HTMLElement,
    );
    confirmDialog('Chốt chào giá này');
    await waitFor(() =>
      expect(acceptQuotation).toHaveBeenCalledWith(
        ID,
        4,
        { quotationId: 'b' },
        { idempotencyKey: expect.any(String) },
      ),
    );
  });
});

describe('household quotation form (studio)', () => {
  beforeEach(() => {
    HTMLDialogElement.prototype.showModal ??= vi.fn();
    HTMLDialogElement.prototype.close ??= vi.fn();
    notifySuccess.mockClear();
  });

  const workspace = (overrides: object = {}) =>
    asClient({
      getRequest: vi.fn().mockResolvedValue(REQUEST),
      listOwnContributions: vi.fn().mockResolvedValue([]),
      listOwnDirectQuotations: vi.fn().mockResolvedValue([]),
      priceHint: vi.fn().mockResolvedValue({ hint: null }),
      createDirectQuotation: vi.fn().mockResolvedValue(QUOTATION),
      reviseDirectQuotation: vi.fn().mockResolvedValue({ ...QUOTATION, version: 4 }),
      withdrawDirectQuotation: vi.fn().mockResolvedValue({ ...QUOTATION, status: 'WITHDRAWN' }),
      ...overrides,
    });

  it('shows the quotation form instead of the contribution form on a request without coordination', async () => {
    const client = workspace();
    renderVi(<LiveContributionWorkspace rfqId={ID} client={client} />);
    expect(await screen.findByRole('button', { name: 'Gửi báo giá' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Gửi đề xuất' })).toBeNull();
    expect(client.listOwnContributions).not.toHaveBeenCalled();
  });

  it('keeps the contribution form on a coordinated request', async () => {
    const client = workspace({
      getRequest: vi.fn().mockResolvedValue({ ...REQUEST, coordinationOptIn: true }),
    });
    renderVi(<LiveContributionWorkspace rfqId={ID} client={client} />);
    expect(await screen.findByRole('button', { name: 'Gửi đề xuất' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Gửi báo giá' })).toBeNull();
    expect(client.listOwnDirectQuotations).not.toHaveBeenCalled();
  });

  it('sends the unit price, completion date and note for the whole quantity', async () => {
    const client = workspace();
    renderVi(<LiveContributionWorkspace rfqId={ID} client={client} />);
    const send = await screen.findByRole('button', { name: 'Gửi báo giá' });
    expect((send as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('Đơn giá (VND)'), { target: { value: '30000' } });
    expect(screen.getByText(/Tổng cho 100 cup: 3\.000\.000/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Ngày hoàn thành'), { target: { value: '2100-01-01' } });
    fireEvent.change(screen.getByLabelText('Ghi chú cho bên mua (không bắt buộc)'), {
      target: { value: 'Fired twice' },
    });
    fireEvent.click(send);
    await waitFor(() =>
      expect(client.createDirectQuotation).toHaveBeenCalledWith(
        ID,
        {
          unitPriceVnd: 30_000,
          completionDate: '2100-01-01T00:00:00.000Z',
          note: 'Fired twice',
        },
        { idempotencyKey: expect.any(String) },
      ),
    );
  });

  // GH#444: the first send can lose its response; retrying it must reuse the key so the API runs it once.
  it('retains the direct quotation key after a failed send and replaces it when the input changes', async () => {
    const client = workspace({
      createDirectQuotation: vi
        .fn()
        .mockRejectedValueOnce(new TypeError('Request timed out'))
        .mockResolvedValue(QUOTATION),
    });
    renderVi(<LiveContributionWorkspace rfqId={ID} client={client} />);
    const send = await screen.findByRole('button', { name: 'Gửi báo giá' });
    const fill = (price: string) => {
      fireEvent.change(screen.getByLabelText('Đơn giá (VND)'), { target: { value: price } });
      fireEvent.change(screen.getByLabelText('Ngày hoàn thành'), {
        target: { value: '2100-01-01' },
      });
    };
    fill('30000');
    fireEvent.click(send);
    await waitFor(() => expect(client.createDirectQuotation).toHaveBeenCalledTimes(1));
    expect(await screen.findByRole('alert')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Gửi báo giá' }));
    await waitFor(() => expect(client.createDirectQuotation).toHaveBeenCalledTimes(2));

    const first = (client.createDirectQuotation as ReturnType<typeof vi.fn>).mock.calls[0]?.[2]
      ?.idempotencyKey;
    expect(first).toEqual(expect.any(String));
    expect(
      (client.createDirectQuotation as ReturnType<typeof vi.fn>).mock.calls[1]?.[2]?.idempotencyKey,
    ).toBe(first);

    // A different price is a different offer: it gets a new key.
    fill('29000');
    fireEvent.click(screen.getByRole('button', { name: 'Gửi báo giá' }));
    await waitFor(() => expect(client.createDirectQuotation).toHaveBeenCalledTimes(3));
    expect(
      (client.createDirectQuotation as ReturnType<typeof vi.fn>).mock.calls[2]?.[2]?.idempotencyKey,
    ).not.toBe(first);
  });

  it('refuses a completion date outside the window', async () => {
    renderVi(<LiveContributionWorkspace rfqId={ID} client={workspace()} />);
    await screen.findByRole('button', { name: 'Gửi báo giá' });
    fireEvent.change(screen.getByLabelText('Đơn giá (VND)'), { target: { value: '30000' } });
    fireEvent.change(screen.getByLabelText('Ngày hoàn thành'), { target: { value: '2099-11-01' } });
    expect(screen.getByText('Ngày hoàn thành phải sau hạn chào giá 01/12/2099.')).toBeTruthy();
    expect(
      (screen.getByRole('button', { name: 'Gửi báo giá' }) as HTMLButtonElement).disabled,
    ).toBe(true);
    fireEvent.change(screen.getByLabelText('Ngày hoàn thành'), { target: { value: '2100-03-01' } });
    expect(screen.getByText(/Ngày hoàn thành không được muộn hơn hạn giao/)).toBeTruthy();
  });

  it('revises an active quotation with its version and withdraws it after confirming', async () => {
    const client = workspace({ listOwnDirectQuotations: vi.fn().mockResolvedValue([QUOTATION]) });
    renderVi(<LiveContributionWorkspace rfqId={ID} client={client} />);
    expect(await screen.findByText(/Báo giá đang chờ bên mua: 30\.000/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Đơn giá (VND)'), { target: { value: '27000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Cập nhật báo giá' }));
    await waitFor(() =>
      expect(client.reviseDirectQuotation).toHaveBeenCalledWith(ID, 3, {
        unitPriceVnd: 27_000,
        completionDate: '2100-01-01T00:00:00.000Z',
      }),
    );
    expect(client.createDirectQuotation).not.toHaveBeenCalled();

    fireEvent.click(await screen.findByRole('button', { name: 'Rút báo giá' }));
    confirmDialog('Rút báo giá');
    await waitFor(() => expect(client.withdrawDirectQuotation).toHaveBeenCalledWith(ID, 3));
  });

  it('offers a fresh form after a withdrawal and none once the buyer decided', async () => {
    const withdrawn = workspace({
      listOwnDirectQuotations: vi.fn().mockResolvedValue([{ ...QUOTATION, status: 'WITHDRAWN' }]),
    });
    const { unmount } = renderVi(<LiveContributionWorkspace rfqId={ID} client={withdrawn} />);
    expect(await screen.findByText('Báo giá đã rút. Gửi lại để tham gia lại.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Gửi báo giá' })).toBeTruthy();
    unmount();

    const accepted = workspace({
      getRequest: vi.fn().mockResolvedValue({ ...REQUEST, status: 'ACCEPTED' }),
      listOwnDirectQuotations: vi.fn().mockResolvedValue([{ ...QUOTATION, status: 'ACCEPTED' }]),
    });
    renderVi(<LiveContributionWorkspace rfqId={ID} client={accepted} />);
    expect(await screen.findByText(/Bên mua đã chốt báo giá của hộ/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Gửi báo giá' })).toBeNull();
  });

  it('shows the requirements and attachments of the request to the household', async () => {
    const client = workspace({
      getRequest: vi.fn().mockResolvedValue({
        ...REQUEST,
        customRequirements: 'Print the logo',
        attachments: [{ id: ID, mimeType: 'image/png', sizeBytes: 4096 }],
      }),
    });
    renderVi(<LiveContributionWorkspace rfqId={ID} client={client} />);
    expect(await screen.findByText('Print the logo')).toBeTruthy();
    expect(screen.getByText(/Tệp đính kèm 1/)).toBeTruthy();
  });

  it('lists the household quotation in the invitations', async () => {
    const rows: MyInvitationDto[] = [
      { request: REQUEST, contribution: null, declined: false, directQuotation: QUOTATION },
      {
        request: { ...REQUEST, id: `${ID}1`, title: 'Chosen' },
        contribution: null,
        declined: false,
        directQuotation: { ...QUOTATION, status: 'ACCEPTED' },
      },
    ];
    renderVi(
      <QuotationInvitations
        client={asClient({ listInvitations: vi.fn().mockResolvedValue(rows) })}
      />,
    );
    expect(
      await screen.findByText(/Đã báo giá: 30\.000\s*₫ một cup, tổng 3\.000\.000/),
    ).toBeTruthy();
    expect(screen.getByText('Bên mua đã chốt báo giá của hộ')).toBeTruthy();
  });

  it('says a legacy quotation without a price or date has no terms, instead of showing zero', async () => {
    // GH#445: a stored quotation without parts reads as nulls. The invitation list must still render,
    // and it must not claim a 0 ₫ price or an empty date.
    const rows: MyInvitationDto[] = [
      {
        request: REQUEST,
        contribution: null,
        declined: false,
        directQuotation: {
          ...QUOTATION,
          unitPriceVnd: null,
          completionDate: null,
          totalVnd: 3_000_000,
        },
      },
    ];
    renderVi(
      <QuotationInvitations
        client={asClient({ listInvitations: vi.fn().mockResolvedValue(rows) })}
      />,
    );
    expect(await screen.findByTestId('invitations')).toBeTruthy();
    expect(screen.queryByText(/Đã báo giá: 0\s*₫/)).toBeNull();
    expect(screen.getByText(/Báo giá thiếu đơn giá hoặc ngày hoàn thành/)).toBeTruthy();
  });

  it('keeps editing a legacy quotation without a price or date, repairing both terms', async () => {
    // GH#445: the stored part still names this household, so the API would refuse a second quotation
    // ("already exists"). The form must keep it editable and send a revision that supplies both terms.
    const legacy = { ...QUOTATION, unitPriceVnd: null, completionDate: null };
    const client = workspace({
      listOwnDirectQuotations: vi.fn().mockResolvedValue([legacy]),
    });
    renderVi(<LiveContributionWorkspace rfqId={ID} client={client} />);
    expect(await screen.findByRole('button', { name: 'Cập nhật báo giá' })).toBeTruthy();
    expect(
      screen.getByText(/Báo giá này thiếu đơn giá hoặc ngày hoàn thành, tổng 3\.000\.000/),
    ).toBeTruthy();
    const price = screen.getByLabelText('Đơn giá (VND)') as HTMLInputElement;
    expect(price.value).toBe('');
    fireEvent.change(price, { target: { value: '27000' } });
    fireEvent.change(screen.getByLabelText('Ngày hoàn thành'), { target: { value: '2100-01-01' } });
    fireEvent.click(screen.getByRole('button', { name: 'Cập nhật báo giá' }));
    await waitFor(() =>
      expect(client.reviseDirectQuotation).toHaveBeenCalledWith(ID, 3, {
        unitPriceVnd: 27_000,
        completionDate: '2100-01-01T00:00:00.000Z',
      }),
    );
    expect(client.createDirectQuotation).not.toHaveBeenCalled();
  });
});

// GH#444: the household's own contribution on a coordinated request is retried with the same key.
describe('coordinated contribution creation (studio)', () => {
  const coordinated = { ...REQUEST, coordinationOptIn: true };
  const contribution = {
    id: ID,
    version: 1,
    householdId: ID,
    maxQuantity: 100,
    unitPriceVnd: 30_000,
    completionDate: '2100-01-01T00:00:00.000Z',
    status: 'ACTIVE' as const,
  };

  const fill = () => {
    fireEvent.change(screen.getByLabelText('Mức tối đa (cup)'), { target: { value: '100' } });
    fireEvent.change(screen.getByLabelText('Đơn giá (VND)'), { target: { value: '30000' } });
    fireEvent.change(screen.getByLabelText('Ngày hoàn thành'), { target: { value: '2100-01-01' } });
  };

  it('sends the offer with its target, body and the held key, and reuses the key after a failure', async () => {
    const createContribution = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('Request timed out'))
      .mockResolvedValue(contribution);
    const client = asClient({
      getRequest: vi.fn().mockResolvedValue(coordinated),
      listOwnContributions: vi.fn().mockResolvedValue([]),
      priceHint: vi.fn().mockResolvedValue({ hint: null }),
      createContribution,
    });
    renderVi(<LiveContributionWorkspace rfqId={ID} client={client} />);
    await screen.findByRole('button', { name: 'Gửi đề xuất' });
    fill();
    fireEvent.click(screen.getByRole('button', { name: 'Gửi đề xuất' }));
    // The form locks while sending; after the failure it offers the same submit again.
    await waitFor(() => expect(createContribution).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(
        (screen.getByRole('button', { name: 'Gửi đề xuất' }) as HTMLButtonElement).disabled,
      ).toBe(false),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Gửi đề xuất' }));
    await waitFor(() => expect(createContribution).toHaveBeenCalledTimes(2));

    const body = {
      maxQuantity: 100,
      unitPriceVnd: 30_000,
      completionDate: '2100-01-01T00:00:00.000Z',
    };
    expect(createContribution).toHaveBeenNthCalledWith(1, ID, body, {
      idempotencyKey: expect.any(String),
    });
    const first = createContribution.mock.calls[0]?.[2]?.idempotencyKey;
    expect(first).toEqual(expect.any(String));
    expect(createContribution.mock.calls[1]?.[2]?.idempotencyKey).toBe(first);
  });
});
