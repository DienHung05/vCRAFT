import { fireEvent, screen, waitFor } from '@testing-library/react';
import type { QuotationClient } from '@vcraft/api-client';
import type { HouseholdSummaryDto, RfqResponse } from '@vcraft/contracts';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RfqForm } from '@/features/rfq/rfq-form';
import {
  EMPTY_RFQ_FORM,
  type RfqFormValues,
  rfqFormPayload,
  rfqFormProblems,
} from '@/features/rfq/rfq-form-model';
import { renderVi } from './render';

const push = vi.fn();
vi.mock('@/i18n/navigation', () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a href="/x">{children}</a>,
  useRouter: () => ({ push }),
}));

const ID = '123e4567-e89b-12d3-a456-426614174000';
const REQUEST = {
  id: ID,
  version: 1,
  status: 'DRAFT',
  invitedHouseholdIds: [],
} as unknown as RfqResponse;

const household = (id: string, name: string, ratingAverage: number | null) =>
  ({ id, name, ratingAverage, ratingCount: ratingAverage === null ? 0 : 3 }) as HouseholdSummaryDto;

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
  customerName: 'Nguyen Van An',
  customerPhone: '0912 345 678',
};

describe('rfq form rules for a customer request', () => {
  const now = new Date('2099-01-01T00:00:00.000Z');
  const mode = { onBehalf: true };

  it('asks for the customer only in the administrator variant', () => {
    expect(rfqFormProblems(EMPTY_RFQ_FORM, now)).not.toHaveProperty('customerName');
    expect(
      rfqFormProblems({ ...VALID, customerName: '', customerPhone: '' }, now, mode),
    ).toMatchObject({ customerName: true, customerPhone: true });
    expect(rfqFormProblems(VALID, now, mode)).toEqual({});
  });

  it('validates the phone number like the API does', () => {
    for (const phone of ['12345', '0112345678', '+1 202 555 0100']) {
      expect(rfqFormProblems({ ...VALID, customerPhone: phone }, now, mode)).toMatchObject({
        customerPhone: true,
      });
    }
    for (const phone of ['0912345678', '+84 912 345 678', '024 3825 1234']) {
      expect(rfqFormProblems({ ...VALID, customerPhone: phone }, now, mode)).toEqual({});
    }
    expect(rfqFormProblems({ ...VALID, customerEmail: 'nope' }, now, mode)).toMatchObject({
      customerEmail: true,
    });
  });

  it('sends the customer and always asks for coordination, and leaves the buyer payload alone', () => {
    const payload = rfqFormPayload(
      { ...VALID, coordinate: false, householdIds: ['h1'], customerEmail: ' an@example.com ' },
      mode,
    );
    expect(payload).toMatchObject({
      coordinationOptIn: true,
      invitedHouseholdIds: ['h1'],
      onBehalfOf: { name: 'Nguyen Van An', phone: '0912 345 678', email: 'an@example.com' },
    });
    expect(rfqFormPayload(VALID)).not.toHaveProperty('onBehalfOf');
  });
});

describe('RfqForm for a customer', () => {
  beforeEach(() => {
    window.localStorage.clear();
    push.mockClear();
  });

  const client = (overrides: Partial<QuotationClient> = {}) =>
    ({
      listHouseholds: vi.fn().mockResolvedValue({
        data: [
          household('h-unrated', 'An Gốm', null),
          household('h-top', 'Bình Gốm', 4.8),
          household('h-mid', 'Cúc Gốm', 3.2),
        ],
      }),
      recordConsent: vi.fn().mockResolvedValue({}),
      ...overrides,
    }) as unknown as QuotationClient;

  const fill = (phone = '0912 345 678') => {
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
    type('Tên khách hàng', 'Nguyen Van An');
    type('Số điện thoại', phone);
  };

  it('shows the customer fields, no consent box and no coordination switch', async () => {
    renderVi(<RfqForm client={client()} onBehalf />);
    expect(await screen.findByLabelText('Tên khách hàng')).toBeTruthy();
    expect(screen.getByLabelText('Số điện thoại')).toBeTruthy();
    expect(screen.getByLabelText('Email (không bắt buộc)')).toBeTruthy();
    expect(screen.queryByRole('checkbox', { name: /Chính sách quyền riêng tư/ })).toBeNull();
    expect(screen.queryByRole('checkbox', { name: /Nhờ Ban quản lý làng điều phối/ })).toBeNull();
  });

  it('does not show the customer fields to a buyer', async () => {
    renderVi(<RfqForm client={client()} />);
    expect(await screen.findByLabelText('Tiêu đề')).toBeTruthy();
    expect(screen.queryByLabelText('Tên khách hàng')).toBeNull();
    expect(screen.queryByLabelText('Số điện thoại')).toBeNull();
  });

  it('lists the best-rated households first, with their rating', async () => {
    renderVi(<RfqForm client={client()} onBehalf />);
    await screen.findByText('Bình Gốm');
    const names = screen
      .getAllByRole('checkbox')
      .map((box) => (box as HTMLInputElement).closest('label')?.textContent ?? '');
    expect(names[0]).toContain('Bình Gốm');
    expect(names[1]).toContain('Cúc Gốm');
    expect(names[2]).toContain('An Gốm');
    expect(screen.getByRole('img', { name: /4,8 trên 5 từ 3 đánh giá/ })).toBeTruthy();
    expect(screen.getByText('Chưa có đánh giá')).toBeTruthy();
  });

  it('refuses an invalid phone number and sends nothing', async () => {
    const createRequest = vi.fn();
    renderVi(<RfqForm client={client({ createRequest })} onBehalf />);
    await screen.findByLabelText('Tên khách hàng');
    fill('12345');
    fireEvent.click(screen.getByRole('button', { name: 'Gửi yêu cầu' }));
    expect(await screen.findByText(/số điện thoại Việt Nam hợp lệ/)).toBeTruthy();
    expect(createRequest).not.toHaveBeenCalled();
  });

  it('creates and sends the request with the customer, no consent, and opens the coordination page', async () => {
    const createRequest = vi.fn().mockResolvedValue({ ...REQUEST, version: 1 });
    const submitRequest = vi.fn().mockResolvedValue({ ...REQUEST, status: 'SENT', version: 2 });
    const recordConsent = vi.fn();
    renderVi(<RfqForm client={client({ createRequest, submitRequest, recordConsent })} onBehalf />);
    await screen.findByLabelText('Tên khách hàng');
    fill();
    fireEvent.click(screen.getByRole('button', { name: 'Gửi yêu cầu' }));
    await waitFor(() =>
      expect(submitRequest).toHaveBeenCalledWith(ID, 1, { idempotencyKey: expect.any(String) }),
    );
    expect(createRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        coordinationOptIn: true,
        onBehalfOf: { name: 'Nguyen Van An', phone: '0912 345 678' },
      }),
      { idempotencyKey: expect.any(String) },
    );
    expect(recordConsent).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(push).toHaveBeenCalledWith({
        pathname: '/admin/dieu-phoi/[code]',
        params: { code: ID },
      }),
    );
    // Nothing is kept in the browser for the next buyer form.
    expect(window.localStorage.getItem('vcraft.rfq-draft')).toBeNull();
  });

  it('does not autosave a half-filled customer request to the server', async () => {
    const createRequest = vi.fn();
    renderVi(<RfqForm client={client({ createRequest })} onBehalf />);
    await screen.findByLabelText('Tên khách hàng');
    fill();
    await new Promise((resolve) => setTimeout(resolve, 1200));
    expect(createRequest).not.toHaveBeenCalled();
  });
});
