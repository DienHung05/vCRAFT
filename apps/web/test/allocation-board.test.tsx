import { fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AllocationBoard, type AllocationBoardProps } from '@/features/admin/allocation-board';
import { confirmDialog } from './confirm';
import { renderVi } from './render';

const CLOSING = '2026-11-10T10:00:00.000Z';
const REQUIRED_BY = '2027-01-15T10:00:00.000Z';

const contributions = [
  {
    householdId: 'hh-a',
    name: 'Gốm Minh Hải',
    tint: '#8a5a3c',
    maxQuantity: 1200,
    unitPriceVnd: 58_000,
    completionDate: '2026-12-20T00:00:00.000Z',
    contributionVersion: 3,
  },
  {
    householdId: 'hh-b',
    name: 'Gốm Lam Ngọc',
    tint: '#3b5079',
    maxQuantity: 900,
    unitPriceVnd: 54_000,
    completionDate: '2026-12-25T00:00:00.000Z',
    contributionVersion: 1,
  },
  {
    householdId: 'hh-c',
    name: 'Lò Đức Phát',
    tint: '#6b7f3c',
    maxQuantity: 1500,
    unitPriceVnd: 61_000,
    completionDate: '2026-12-30T00:00:00.000Z',
    contributionVersion: 2,
  },
] as const satisfies AllocationBoardProps['contributions'];

function props(overrides: Partial<AllocationBoardProps> = {}): AllocationBoardProps {
  return {
    rfqId: '0b8f7a5e-1c2d-4e3f-a5b6-c7d8e9f0a1b2',
    rfqCode: 'RFQ-2026-000131',
    requestVersion: 4,
    quantity: 3000,
    unit: 'bát',
    biddingClosesAt: CLOSING,
    requiredBy: REQUIRED_BY,
    contributions,
    ...overrides,
  };
}

const set = (name: string, value: string) =>
  fireEvent.change(screen.getByLabelText(`Nhập số lượng cho ${name}`), { target: { value } });

/** With a live `onSubmit` the send button first asks for a confirmation. */
const sendAndConfirm = () => {
  fireEvent.click(submitButton());
  confirmDialog('Gửi chào giá liên kết');
};

const submitButton = () =>
  screen.getByRole('button', { name: 'Gửi chào giá liên kết' }) as HTMLButtonElement;

describe('AllocationBoard (chia đơn thủ công, GH#10)', () => {
  it('khởi đầu bằng 0, chưa chia đủ thì khóa gửi và báo còn thiếu', () => {
    renderVi(<AllocationBoard {...props()} />);
    expect(
      (screen.getByLabelText('Nhập số lượng cho Gốm Minh Hải') as HTMLInputElement).value,
    ).toBe('0');
    expect(submitButton().disabled).toBe(true);
    expect(screen.getByText(/Còn thiếu 3\.000 bát/)).toBeTruthy();
  });

  it('lấy giá trị nháp được cung cấp sẵn làm điểm bắt đầu', () => {
    renderVi(<AllocationBoard {...props()} initialQuantities={[1200, 900, 900]} />);
    expect(
      (screen.getByLabelText('Nhập số lượng cho Gốm Lam Ngọc') as HTMLInputElement).value,
    ).toBe('900');
  });

  it('chia đúng bằng số lượng yêu cầu (không hơn không kém) thì mở gửi', () => {
    renderVi(<AllocationBoard {...props()} />);
    set('Gốm Minh Hải', '1200');
    set('Gốm Lam Ngọc', '900');
    set('Lò Đức Phát', '900');
    expect(submitButton().disabled).toBe(false);
    set('Lò Đức Phát', '901');
    expect(submitButton().disabled).toBe(true);
    expect(screen.getByText(/Đang chia thừa 1 bát/)).toBeTruthy();
  });

  it('hộ vượt mức tối đa đã khai bị báo và khóa gửi dù tổng vừa đủ', () => {
    renderVi(<AllocationBoard {...props()} />);
    // 1200 + 900 + 900 = 3000, nhưng Lam Ngọc chỉ khai tối đa 900.
    set('Gốm Minh Hải', '1200');
    set('Gốm Lam Ngọc', '1000');
    set('Lò Đức Phát', '800');
    expect(submitButton().disabled).toBe(true);
    expect(screen.getAllByText(/Gốm Lam Ngọc vượt mức tối đa/).length).toBeGreaterThan(0);
  });

  it('số lượng không hợp lệ bị báo explicitly, không tự làm tròn âm thầm', () => {
    renderVi(<AllocationBoard {...props()} />);
    set('Gốm Minh Hải', '1000.5');
    expect(screen.getAllByText(/Số lượng của mỗi hộ phải là số nguyên/).length).toBeGreaterThan(0);
    expect(submitButton().disabled).toBe(true);
    set('Gốm Minh Hải', '-5');
    expect(submitButton().disabled).toBe(true);
  });

  it('hiện ngày hoàn thành tuyệt đối của từng hộ, không suy ra từ số ngày sản xuất', () => {
    renderVi(<AllocationBoard {...props()} />);
    expect(screen.getByText(/20\/12\/2026/)).toBeTruthy();
    expect(screen.getByText(/25\/12\/2026/)).toBeTruthy();
    expect(screen.getByText(/30\/12\/2026/)).toBeTruthy();
  });

  it('đóng góp có ngày hoàn thành không hợp lệ (trước hạn chào giá) thì khóa gửi và báo lỗi', () => {
    const bad: AllocationBoardProps['contributions'] = [
      {
        ...contributions[0],
        completionDate: '2026-11-01T00:00:00.000Z', // trước hạn chào giá 10/11
      },
      contributions[1],
      contributions[2],
    ];
    renderVi(<AllocationBoard {...props({ contributions: bad })} />);
    set('Gốm Minh Hải', '1200');
    set('Gốm Lam Ngọc', '900');
    set('Lò Đức Phát', '900');
    expect(submitButton().disabled).toBe(true);
    expect(screen.getByText(/Ngày hoàn thành phải sau hạn chào giá/)).toBeTruthy();
  });

  it('kèm phụ phí và điều kiện giao hàng trong bản chào giá', () => {
    renderVi(<AllocationBoard {...props()} />);
    const charge = screen.getByLabelText('Phụ phí giao hàng') as HTMLInputElement;
    fireEvent.change(charge, { target: { value: '2_000_000'.replace(/_/g, '') } });
    fireEvent.click(screen.getByRole('radio', { name: 'Bên mua chịu phí vận chuyển' }));
    expect(screen.getByText(/Tổng cho bên mua/)).toBeTruthy();
  });

  it('gọi callback với đủ phần chia (không kèm giá nội bộ ra ngoài) và báo thành công', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    renderVi(<AllocationBoard {...props()} onSubmit={onSubmit} />);
    set('Gốm Minh Hải', '1200');
    set('Gốm Lam Ngọc', '900');
    set('Lò Đức Phát', '900');
    sendAndConfirm();
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledWith({
      requestVersion: 4,
      parts: [
        {
          householdId: 'hh-a',
          quantity: 1200,
          unitPriceVnd: 58_000,
          completionDate: '2026-12-20T00:00:00.000Z',
          contributionVersion: 3,
        },
        {
          householdId: 'hh-b',
          quantity: 900,
          unitPriceVnd: 54_000,
          completionDate: '2026-12-25T00:00:00.000Z',
          contributionVersion: 1,
        },
        {
          householdId: 'hh-c',
          quantity: 900,
          unitPriceVnd: 61_000,
          completionDate: '2026-12-30T00:00:00.000Z',
          contributionVersion: 2,
        },
      ],
      additionalChargeVnd: 0,
      deliveryTerms: 'INCLUDED',
    });
    expect(screen.getByText(/Đã gửi chào giá liên kết/)).toBeTruthy();
  });

  it('callback từ chối thì hiện lỗi và cho gửi lại', async () => {
    const onSubmit = vi.fn().mockRejectedValueOnce(new Error('MẠNG LỖI'));
    renderVi(<AllocationBoard {...props()} onSubmit={onSubmit} />);
    set('Gốm Minh Hải', '1200');
    set('Gốm Lam Ngọc', '900');
    set('Lò Đức Phát', '900');
    sendAndConfirm();
    await waitFor(() => expect(screen.getByText('MẠNG LỖI')).toBeTruthy());
    expect(submitButton().disabled).toBe(false);
    // Gửi lại được sau khi lỗi.
    sendAndConfirm();
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(2));
  });

  it('không có callback thì mô phỏng cục bộ và ghi nhãn demo rõ ràng', async () => {
    renderVi(<AllocationBoard {...props()} />);
    set('Gốm Minh Hải', '1200');
    set('Gốm Lam Ngọc', '900');
    set('Lò Đức Phát', '900');
    fireEvent.click(submitButton());
    expect(screen.getByText('Đã mô phỏng (chưa lưu, không gửi thông báo)')).toBeTruthy();
    expect(screen.getByText(/chưa lưu, chưa gửi lên máy chủ/)).toBeTruthy();
  });
});

it('sends only the selected households when their quantities cover the whole request', async () => {
  const onSubmit = vi.fn().mockResolvedValue(undefined);
  renderVi(<AllocationBoard {...props({ quantity: 2100 })} onSubmit={onSubmit} />);
  set('Gốm Minh Hải', '1200');
  set('Gốm Lam Ngọc', '900');
  expect(submitButton().disabled).toBe(false);
  sendAndConfirm();
  await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
  expect(
    onSubmit.mock.calls[0]?.[0].parts.map((part: { householdId: string }) => part.householdId),
  ).toEqual(['hh-a', 'hh-b']);
});
