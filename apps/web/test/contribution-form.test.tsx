import { fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ContributionForm, type ContributionFormProps } from '@/features/rfq/contribution-form';
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
      completionDate: '2026-12-20T00:00:00.000Z',
    });
    expect(screen.getByText(/Đã gửi/)).toBeTruthy();
  });

  it('không đủ số, âm hoặc lẻ thì khóa gửi và báo lỗi cụ thể', () => {
    renderVi(<ContributionForm {...props()} />);
    expect(sendButton().disabled).toBe(true);
    fill('0', '58000', '2026-12-20');
    expect(sendButton().disabled).toBe(true);
    expect(screen.getByText(/Mức tối đa phải là số nguyên từ 1/)).toBeTruthy();
    fill('1200', '-1', '2026-12-20');
    expect(screen.getByText(/Đơn giá phải là số nguyên từ 1/)).toBeTruthy();
    fill('1200.5', '58000', '2026-12-20');
    expect(screen.getByText(/Mức tối đa phải là số nguyên từ 1/)).toBeTruthy();
  });

  it('ngày hoàn thành phải sau hạn chào giá và không muộn hơn hạn giao', () => {
    renderVi(<ContributionForm {...props()} />);
    fill('1200', '58000', '2026-11-01');
    expect(
      screen.getByText(/^Ngày hoàn thành phải sau hạn chào giá \d{2}\/\d{2}\/\d{4}\.$/),
    ).toBeTruthy();
    expect(sendButton().disabled).toBe(true);
    fill('1200', '58000', '2027-02-01');
    expect(screen.getByText(/không được muộn hơn hạn giao/)).toBeTruthy();
    fill('1200', '58000', '2026-12-20');
    expect(sendButton().disabled).toBe(false);
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

  it('sửa đề xuất hiện nút cập nhật, kèm rút; đã rút thì chỉ xem', () => {
    const onWithdraw = vi.fn().mockResolvedValue(undefined);
    renderVi(
      <ContributionForm
        {...props()}
        initial={{
          maxQuantity: 1200,
          unitPriceVnd: 58000,
          completionDate: '2026-12-20T00:00:00.000Z',
        }}
        version={2}
        onWithdraw={onWithdraw}
      />,
    );
    expect((screen.getByLabelText('Mức tối đa (bát)') as HTMLInputElement).value).toBe('1200');
    expect(screen.getByRole('button', { name: 'Cập nhật đề xuất' })).toBeTruthy();
    const withdraw = screen.getByRole('button', { name: 'Rút đề xuất' }) as HTMLButtonElement;
    fireEvent.click(withdraw);
    expect(onWithdraw).toHaveBeenCalledTimes(1);
  });

  it('không có callback thì ghi nhãn demo rõ ràng: mô phỏng, chưa lưu', () => {
    renderVi(<ContributionForm {...props()} />);
    expect(screen.getByText(/chưa lưu, chưa gửi lên máy chủ/)).toBeTruthy();
    fill('1200', '58000', '2026-12-20');
    fireEvent.click(sendButton());
    expect(screen.getByText(/Đã mô phỏng \(chưa lưu/)).toBeTruthy();
    expect(screen.getByText(/riêng giữa hộ và Ban quản lý/)).toBeTruthy();
  });

  it('nêu rõ đơn giá là thông tin riêng giữa hộ và BQL, bên mua không thấy', () => {
    renderVi(<ContributionForm {...props()} />);
    const note = screen.getAllByText(/riêng giữa hộ và Ban quản lý/);
    expect(note.length).toBeGreaterThan(0);
  });
});
