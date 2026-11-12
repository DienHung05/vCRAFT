import { fireEvent, screen, waitFor } from '@testing-library/react';
import { messages } from '@vcraft/i18n';
import { describe, expect, it, vi } from 'vitest';
import { ContributionForm, type ContributionFormProps } from '@/features/rfq/contribution-form';
import { confirmDialog } from './confirm';
import { renderVi } from './render';

const CLOSING = '2026-11-10T10:00:00.000Z';
const REQUIRED_BY = '2027-01-15T10:00:00.000Z';

function props(overrides: Partial<ContributionFormProps> = {}): ContributionFormProps {
  return {
    rfqCode: '0b8f7a5e-1c2d-4e3f-a5b6-c7d8e9f0a1b2',
    quantity: 3000,
    unit: 'bát',
    biddingClosesAt: CLOSING,
    requiredBy: REQUIRED_BY,
    ...overrides,
  };
}

const sendButton = () => screen.getByRole('button', { name: 'Gửi đề xuất' }) as HTMLButtonElement;
const fill = (max: string, price: string, date: string) => {
  fireEvent.change(screen.getByLabelText('Mức tối đa (bát)'), { target: { value: max } });
  fireEvent.change(screen.getByLabelText('Đơn giá (VND)'), { target: { value: price } });
  fireEvent.change(screen.getByLabelText('Ngày hoàn thành'), { target: { value: date } });
};

describe('ContributionForm (đề xuất tham gia, GH#10)', () => {
  it('đủ khai: mức tối đa, đơn giá, ngày hoàn thành hợp lệ thì gọi callback với ISO tuyệt đối', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    renderVi(<ContributionForm {...props()} onSubmit={onSubmit} />);
    fill('1200', '58000', '2026-12-20');
    fireEvent.click(sendButton());
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledWith({
      maxQuantity: 1200,
      unitPriceVnd: 58000,
      completionDate: '2026-12-20T16:59:59.000Z',
    });
    expect(screen.getByText(/Đã gửi/)).toBeTruthy();
  });

  it('the promised day is due at its end in Vietnam, so the delivery day itself is allowed (GH#443)', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    // The buyer's delivery date, as the buyer form sends it: end of 15 Jan in Vietnam.
    renderVi(
      <ContributionForm
        {...props({ requiredBy: '2027-01-15T16:59:59.000Z' })}
        onSubmit={onSubmit}
      />,
    );
    fill('1200', '58000', '2027-01-15');
    fireEvent.click(sendButton());
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ completionDate: '2027-01-15T16:59:59.000Z' }),
      ),
    );
  });

  it('không đủ số, âm hoặc lẻ thì không gửi và báo lỗi cụ thể cạnh ô', () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    renderVi(<ContributionForm {...props()} onSubmit={onSubmit} />);
    fill('0', '58000', '2026-12-20');
    fireEvent.click(sendButton());
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText(/Mức tối đa phải là số nguyên từ 1/)).toBeTruthy();
    fill('1200', '-1', '2026-12-20');
    expect(screen.getByText(/Đơn giá phải là số nguyên từ 1/)).toBeTruthy();
    fill('1200.5', '58000', '2026-12-20');
    expect(screen.getByText(/Mức tối đa phải là số nguyên từ 1/)).toBeTruthy();
  });

  it('ngày hoàn thành phải sau hạn chào giá và không muộn hơn hạn giao', () => {
    renderVi(<ContributionForm {...props()} />);
    fill('1200', '58000', '2026-11-01');
    fireEvent.blur(screen.getByLabelText('Ngày hoàn thành'));
    expect(
      screen.getByText(/^Ngày hoàn thành phải sau hạn chào giá \d{2}\/\d{2}\/\d{4}\.$/),
    ).toBeTruthy();
    fill('1200', '58000', '2027-02-01');
    expect(screen.getByText(/không được muộn hơn hạn giao/)).toBeTruthy();
    fill('1200', '58000', '2026-12-20');
    expect(screen.queryByText(/không được muộn hơn hạn giao/)).toBeNull();
    expect(
      screen.queryByText(/^Ngày hoàn thành phải sau hạn chào giá \d{2}\/\d{2}\/\d{4}\.$/),
    ).toBeNull();
  });

  it('a fresh form shows no error text and keeps the send button enabled (GH#477)', () => {
    renderVi(<ContributionForm {...props()} />);
    expect(screen.queryByText(/Mức tối đa phải là số nguyên/)).toBeNull();
    expect(screen.queryByText(/Đơn giá phải là số nguyên/)).toBeNull();
    expect(screen.queryByText('Chọn ngày hoàn thành.')).toBeNull();
    for (const label of ['Mức tối đa (bát)', 'Đơn giá (VND)', 'Ngày hoàn thành'])
      expect(screen.getByLabelText(label).getAttribute('aria-invalid')).toBeNull();
    expect(sendButton().disabled).toBe(false);
  });

  it('blurring an empty required field shows its error, linked by aria-describedby (GH#477)', () => {
    renderVi(<ContributionForm {...props()} />);
    const max = screen.getByLabelText('Mức tối đa (bát)');
    fireEvent.blur(max);
    const error = screen.getByText(/Mức tối đa phải là số nguyên từ 1/);
    expect(max.getAttribute('aria-invalid')).toBe('true');
    expect(max.getAttribute('aria-describedby')).toContain(error.id);
    expect(error.id).not.toBe('');
    // The other fields were not touched, so they stay quiet.
    expect(screen.queryByText(/Đơn giá phải là số nguyên/)).toBeNull();
    expect(screen.queryByText('Chọn ngày hoàn thành.')).toBeNull();
    // The price keeps its words description next to the error.
    const price = screen.getByLabelText('Đơn giá (VND)');
    fireEvent.blur(price);
    const priceError = screen.getByText(/Đơn giá phải là số nguyên từ 1/);
    expect(price.getAttribute('aria-describedby')).toContain(priceError.id);
    expect(price.getAttribute('aria-describedby')?.split(' ').length).toBe(2);
  });

  it('submitting an empty form shows every error next to its field and focuses the first (GH#477)', () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    renderVi(<ContributionForm {...props()} onSubmit={onSubmit} />);
    fireEvent.click(sendButton());
    expect(onSubmit).not.toHaveBeenCalled();
    const cases: [string, RegExp][] = [
      ['Mức tối đa (bát)', /Mức tối đa phải là số nguyên từ 1/],
      ['Đơn giá (VND)', /Đơn giá phải là số nguyên từ 1/],
      ['Ngày hoàn thành', /^Chọn ngày hoàn thành\.$/],
    ];
    for (const [label, message] of cases) {
      const input = screen.getByLabelText(label);
      const error = screen.getByText(message);
      expect(input.getAttribute('aria-invalid')).toBe('true');
      expect(input.getAttribute('aria-describedby')).toContain(error.id);
      expect(error.parentElement?.contains(input)).toBe(true);
    }
    expect(document.activeElement).toBe(screen.getByLabelText('Mức tối đa (bát)'));
    // No list of errors is left under the button.
    expect(screen.queryByRole('list')).toBeNull();
  });

  it('the edit variant shows no error until a field is cleared and blurred (GH#477)', () => {
    renderVi(
      <ContributionForm
        {...props()}
        initial={{
          maxQuantity: 1200,
          unitPriceVnd: 58000,
          completionDate: '2026-12-20T16:59:59.000Z',
        }}
        version={2}
        onSubmit={vi.fn().mockResolvedValue(undefined)}
      />,
    );
    expect(screen.queryByText(/phải là số nguyên/)).toBeNull();
    const price = screen.getByLabelText('Đơn giá (VND)');
    fireEvent.change(price, { target: { value: '' } });
    fireEvent.blur(price);
    expect(screen.getByText(/Đơn giá phải là số nguyên từ 1/)).toBeTruthy();
  });

  it('has no developer wording (API, session) in the contribution messages (GH#477)', () => {
    for (const locale of ['vi', 'en'] as const) {
      const values: string[] = [];
      const walk = (node: unknown) => {
        if (typeof node === 'string') values.push(node);
        else if (node && typeof node === 'object') Object.values(node).forEach(walk);
      };
      walk(messages[locale].contribution);
      const text = values.join('\n');
      expect(text).not.toMatch(/\bAPI\b/);
      expect(text).not.toMatch(/phiên đăng nhập|signed-in session/i);
    }
  });

  it('callback từ chối thì hiện lỗi và sửa gửi lại được', async () => {
    const onSubmit = vi.fn().mockRejectedValueOnce(new Error('MẠNG LỖI'));
    renderVi(<ContributionForm {...props()} onSubmit={onSubmit} />);
    fill('1200', '58000', '2026-12-20');
    fireEvent.click(sendButton());
    await waitFor(() => expect(screen.getByText('MẠNG LỖI')).toBeTruthy());
    expect(
      (screen.getByRole('button', { name: 'Gửi đề xuất' }) as HTMLButtonElement).disabled,
    ).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Gửi đề xuất' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(2));
  });

  it('sửa đề xuất hiện nút cập nhật, kèm rút; đã rút thì chỉ xem', async () => {
    const onWithdraw = vi.fn().mockResolvedValue(undefined);
    renderVi(
      <ContributionForm
        {...props()}
        initial={{
          maxQuantity: 1200,
          unitPriceVnd: 58000,
          completionDate: '2026-12-20T16:59:59.000Z',
        }}
        version={2}
        onWithdraw={onWithdraw}
      />,
    );
    expect((screen.getByLabelText('Mức tối đa (bát)') as HTMLInputElement).value).toBe('1200');
    expect(screen.getByRole('button', { name: 'Cập nhật đề xuất' })).toBeTruthy();
    const withdraw = screen.getByRole('button', { name: 'Rút đề xuất' }) as HTMLButtonElement;
    fireEvent.click(withdraw);
    expect(onWithdraw).not.toHaveBeenCalled();
    confirmDialog('Rút đề xuất');
    await waitFor(() => expect(onWithdraw).toHaveBeenCalledTimes(1));
  });

  it('không có callback thì nói rõ là chỉ xem trước, chưa lưu', () => {
    renderVi(<ContributionForm {...props()} />);
    expect(screen.getByText(/chưa lưu, chưa gửi lên máy chủ/)).toBeTruthy();
    fill('1200', '58000', '2026-12-20');
    fireEvent.click(sendButton());
    expect(screen.getByText(/Đã xem trước \(chưa lưu/)).toBeTruthy();
    expect(screen.getByText(/riêng giữa hộ và Ban quản lý/)).toBeTruthy();
  });

  it('nêu rõ đơn giá là thông tin riêng giữa hộ và BQL, bên mua không thấy', () => {
    renderVi(<ContributionForm {...props()} />);
    const note = screen.getAllByText(/riêng giữa hộ và Ban quản lý/);
    expect(note.length).toBeGreaterThan(0);
  });

  it('shows the suggested price range with what it is based on', () => {
    renderVi(
      <ContributionForm
        {...props({
          priceHint: {
            minVnd: 45_000,
            maxVnd: 75_000,
            basis: 'MIXED',
            ownSamples: 1,
            catalogSamples: 3,
          },
        })}
      />,
    );
    expect(screen.getByText(/^Gợi ý: 45\.000\s₫ – 75\.000\s₫ mỗi đơn vị\.$/)).toBeTruthy();
    expect(
      screen.getByText(/1 đề xuất trước của hộ bạn và 3 sản phẩm cùng loại đang niêm yết/),
    ).toBeTruthy();
  });

  it('shows no hint without data', () => {
    renderVi(<ContributionForm {...props({ priceHint: null })} />);
    expect(screen.queryByText(/Gợi ý:/)).toBeNull();
  });
});
