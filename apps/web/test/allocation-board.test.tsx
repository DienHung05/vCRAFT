import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AllocationBoard } from '@/features/admin/allocation-board';
import { demoParams, getArtisan, getCoordination } from '@/lib/demo/data';
import { renderVi } from './render';

async function board() {
  const code = demoParams.coordinations[0] ?? '';
  const c = await getCoordination(code);
  if (!c) throw new Error('thiếu dữ liệu mẫu');
  const artisans = await Promise.all(c.candidates.map((x) => getArtisan(x.artisanSlug)));
  return (
    <AllocationBoard
      rfqCode={c.rfqCode}
      quantity={c.quantity}
      unit={c.unit}
      requiredBy={c.requiredBy}
      plans={c.plans}
      parts={c.candidates.map((x, i) => ({
        slug: x.artisanSlug,
        name: artisans[i]?.household ?? '',
        tint: artisans[i]?.tint ?? '#000',
        capacity: x.capacity,
        unitPrice: x.unitPrice,
        leadDays: x.leadDays,
      }))}
    />
  );
}

describe('AllocationBoard (FR-ORD-03, BR-L6)', () => {
  it('phương án đề xuất hợp lệ thì gửi được; sửa tay sai thì khóa nút và báo thiếu', async () => {
    renderVi(await board());
    const send = screen.getByRole('button', {
      name: 'Mô phỏng gửi chào giá liên kết',
    }) as HTMLButtonElement;
    expect(send.disabled).toBe(false);
    expect(screen.getByText(/Đã chia đủ 3\.000 bát/)).toBeTruthy();

    fireEvent.change(screen.getByLabelText('Nhập số lượng cho Gốm Minh Hải'), {
      target: { value: '800' },
    });
    expect(send.disabled).toBe(true);
    expect(screen.getByText(/Còn thiếu 57 bát/)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Về phương án đề xuất' }));
    expect(send.disabled).toBe(false);
  });

  it('hộ vượt năng lực bị báo và khóa gửi dù tổng đủ', async () => {
    renderVi(await board());
    // Hạnh Thủy năng lực 600: chuyển 100 từ Minh Hải sang để Σ vẫn 3000.
    fireEvent.change(screen.getByLabelText('Nhập số lượng cho Gốm Hạnh Thủy'), {
      target: { value: '700' },
    });
    fireEvent.change(screen.getByLabelText('Nhập số lượng cho Lò Đức Phát'), {
      target: { value: '800' },
    });
    const send = screen.getByRole('button', {
      name: 'Mô phỏng gửi chào giá liên kết',
    }) as HTMLButtonElement;
    expect(send.disabled).toBe(true);
    expect(screen.getAllByText(/Gốm Hạnh Thủy vượt năng lực còn trống/).length).toBeGreaterThan(0);
  });

  it('đổi chiến lược áp phương án tương ứng', async () => {
    renderVi(await board());
    fireEvent.click(screen.getByRole('radio', { name: /Giá thấp trước/ }));
    const input = screen.getByLabelText('Nhập số lượng cho Gốm Hạnh Thủy') as HTMLInputElement;
    expect(input.value).toBe('600');
    expect((screen.getByLabelText('Nhập số lượng cho Lò Đức Phát') as HTMLInputElement).value).toBe(
      '300',
    );
  });

  it('gửi chỉ là mô phỏng cục bộ: hiện nhãn demo, báo đã mô phỏng và chặn bấm lặp', async () => {
    renderVi(await board());
    expect(screen.getByText(/chưa lưu, chưa gửi lên máy chủ/)).toBeTruthy();
    expect(screen.queryByText(/đã gửi tới bên mua/)).toBeNull();

    const send = screen.getByRole('button', {
      name: 'Mô phỏng gửi chào giá liên kết',
    }) as HTMLButtonElement;
    fireEvent.click(send);
    expect(screen.getByText('Đã mô phỏng (chưa lưu, không gửi thông báo)')).toBeTruthy();
    expect(screen.getByText(/Chưa có chào giá nào tới bên mua/)).toBeTruthy();

    const done = screen.getByRole('button', { name: 'Đã mô phỏng' }) as HTMLButtonElement;
    expect(done.disabled).toBe(true);
    fireEvent.click(done);
    expect(screen.getAllByText('Đã mô phỏng (chưa lưu, không gửi thông báo)')).toHaveLength(1);
  });
});
