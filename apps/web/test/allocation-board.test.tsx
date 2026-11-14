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
    expect(screen.getByText(/Đã lưu chào giá\./)).toBeTruthy();
    // GH#535: no backend plumbing or raw request id in the live view.
    expect(document.body.textContent).not.toMatch(/\bAPI\b|phiên đăng nhập|máy chủ/i);
    expect(document.body.textContent).not.toContain('0b8f7a5e-1c2d-4e3f-a5b6-c7d8e9f0a1b2');
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

  it('không có callback thì chỉ xem trước cục bộ và nói rõ là chưa lưu', async () => {
    renderVi(<AllocationBoard {...props()} />);
    set('Gốm Minh Hải', '1200');
    set('Gốm Lam Ngọc', '900');
    set('Lò Đức Phát', '900');
    fireEvent.click(submitButton());
    expect(screen.getByText('Đã xem trước (chưa lưu, không gửi thông báo)')).toBeTruthy();
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

/** GH#247, SRS BR-06 / FR-ORD-03 / AC-3: the admin picks a strategy and the board is filled. */
describe('AllocationBoard strategy picker', () => {
  const value = (name: string) =>
    Number((screen.getByLabelText(`Nhập số lượng cho ${name}`) as HTMLInputElement).value);
  const pick = (name: string) => fireEvent.click(screen.getByRole('button', { name }));

  // Capacities 2.000 / 1.500 / 1.200 / 1.000 from AC-3.
  const ac3 = [
    ['hh-1', 'Hộ Một', 2000, 30_000, '2026-12-20T00:00:00.000Z'],
    ['hh-2', 'Hộ Hai', 1500, 32_000, '2026-12-22T00:00:00.000Z'],
    ['hh-3', 'Hộ Ba', 1200, 34_000, '2026-12-28T00:00:00.000Z'],
    ['hh-4', 'Hộ Bốn', 1000, 36_000, '2026-12-24T00:00:00.000Z'],
  ].map(([householdId, name, capacity, unitPriceVnd, completionDate], i) => ({
    householdId: householdId as string,
    name: name as string,
    tint: '#8a5a3c',
    maxQuantity: capacity as number,
    capacity: capacity as number,
    unitPriceVnd: unitPriceVnd as number,
    completionDate: completionDate as string,
    contributionVersion: i + 1,
  }));

  it('offers the three strategies of BR-06 and none is applied at first', () => {
    renderVi(<AllocationBoard {...props()} />);
    for (const name of ['Theo năng lực', 'Giá thấp trước', 'Cân bằng'])
      expect(screen.getByRole('button', { name }).getAttribute('aria-pressed')).toBe('false');
    expect(value('Gốm Minh Hải')).toBe(0);
  });

  it('AC-3: "Theo năng lực" proposes 1754 / 1316 / 1053 / 877, then 900 for the fourth blocks sending', () => {
    renderVi(<AllocationBoard {...props({ quantity: 5000, contributions: ac3 })} />);
    pick('Theo năng lực');
    expect([value('Hộ Một'), value('Hộ Hai'), value('Hộ Ba'), value('Hộ Bốn')]).toEqual([
      1754, 1316, 1053, 877,
    ]);
    expect(submitButton().disabled).toBe(false);
    expect(screen.getByText(/Đã chia đủ 5\.000 bát/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Theo năng lực' }).getAttribute('aria-pressed')).toBe(
      'true',
    );

    set('Hộ Bốn', '900');
    expect(submitButton().disabled).toBe(true);
    expect(screen.getByText(/Đang chia thừa 23 bát/)).toBeTruthy();
    // A hand edit makes the plan the admin's own: the strategy is no longer marked as applied.
    expect(screen.getByRole('button', { name: 'Theo năng lực' }).getAttribute('aria-pressed')).toBe(
      'false',
    );
  });

  it('"Giá thấp trước" fills the cheapest household up to its maximum first', () => {
    renderVi(<AllocationBoard {...props()} />);
    pick('Giá thấp trước');
    // Lam Ngọc 54.000 (max 900), Minh Hải 58.000 (max 1.200), Đức Phát 61.000 takes the last 900.
    expect([value('Gốm Minh Hải'), value('Gốm Lam Ngọc'), value('Lò Đức Phát')]).toEqual([
      1200, 900, 900,
    ]);
    expect(submitButton().disabled).toBe(false);
  });

  it('"Cân bằng" shares equally and lets a small household cap out', () => {
    renderVi(<AllocationBoard {...props()} />);
    pick('Cân bằng');
    // 1.000 each, but Lam Ngọc offered at most 900: the 100 left is shared by the other two.
    expect([value('Gốm Minh Hải'), value('Gốm Lam Ngọc'), value('Lò Đức Phát')]).toEqual([
      1050, 900, 1050,
    ]);
  });

  it('shows the resulting total, price and expected completion date', () => {
    renderVi(<AllocationBoard {...props()} />);
    pick('Giá thấp trước');
    // 1.200 × 58.000 + 900 × 54.000 + 900 × 61.000; the latest date is the one of Lò Đức Phát.
    expect(screen.getByText(/Đã đề xuất theo "Giá thấp trước": 3\.000 \/ 3\.000 bát/)).toBeTruthy();
    expect(screen.getByText(/dự kiến xong 30\/12\/2026/)).toBeTruthy();
    expect(screen.getByText('Dự kiến hoàn thành').nextElementSibling?.textContent).toMatch(
      /30\/12\/2026/,
    );
    expect(screen.getByText('Tiền hàng')).toBeTruthy();
  });

  it('lets the admin edit the proposal by hand and keeps the sum check', () => {
    renderVi(<AllocationBoard {...props()} />);
    pick('Cân bằng');
    set('Gốm Minh Hải', '1100');
    expect(value('Gốm Minh Hải')).toBe(1100);
    expect(submitButton().disabled).toBe(true);
    expect(screen.getByText(/Đang chia thừa 50 bát/)).toBeTruthy();
    set('Gốm Minh Hải', '1050');
    expect(submitButton().disabled).toBe(false);
  });

  it('flags a shortfall when the households cannot cover the request together', () => {
    renderVi(<AllocationBoard {...props({ quantity: 5000 })} />);
    pick('Theo năng lực');
    expect(screen.getByRole('alert').textContent).toMatch(/tối đa 3\.600 bát.*thiếu 1\.400 bát/);
    expect(value('Gốm Minh Hải') + value('Gốm Lam Ngọc') + value('Lò Đức Phát')).toBe(3600);
    expect(submitButton().disabled).toBe(true);
  });

  it('never proposes above a declared capacity lower than the offered maximum', () => {
    const capped = contributions.map((c, i) => ({ ...c, capacity: i === 2 ? 800 : null }));
    renderVi(<AllocationBoard {...props({ quantity: 2000, contributions: capped })} />);
    pick('Giá thấp trước');
    expect(value('Lò Đức Phát')).toBeLessThanOrEqual(800);
    expect(value('Gốm Minh Hải') + value('Gốm Lam Ngọc') + value('Lò Đức Phát')).toBe(2000);
  });

  it('flags a hand-typed share above the declared capacity (BR-L6)', () => {
    const capped = [{ ...contributions[0], maxQuantity: 5000, capacity: 1000 }, contributions[1]];
    renderVi(<AllocationBoard {...props({ quantity: 1900, contributions: capped })} />);
    set('Gốm Minh Hải', '1000');
    set('Gốm Lam Ngọc', '900');
    expect(submitButton().disabled).toBe(false);
    set('Gốm Minh Hải', '1001');
    set('Gốm Lam Ngọc', '899');
    expect(submitButton().disabled).toBe(true);
    expect(
      screen.getAllByText(/Gốm Minh Hải vượt năng lực hộ đã khai \(1\.000\)/).length,
    ).toBeGreaterThan(0);
  });

  it('disables the picker while the request is closed', () => {
    renderVi(<AllocationBoard {...props({ disabled: true })} />);
    expect((screen.getByRole('button', { name: 'Cân bằng' }) as HTMLButtonElement).disabled).toBe(
      true,
    );
  });
});
