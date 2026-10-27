import { fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { RfqWorkspace } from '@/features/rfq/rfq-workspace';
import { demoParams, getRfq } from '@/lib/demo/data';
import { renderVi } from './render';

async function workspace() {
  const rfq = await getRfq(demoParams.rfqs[0] ?? '');
  if (!rfq) throw new Error('thiếu dữ liệu mẫu');
  return <RfqWorkspace rfq={rfq}>{null}</RfqWorkspace>;
}

/** Hộp thoại đang mở (trang có hai `<dialog>`, chỉ một cái mở tại một thời điểm). */
const openDialog = () => {
  const el = document.querySelector<HTMLElement>('dialog[open]');
  if (!el) throw new Error('không có hộp thoại nào đang mở');
  return el;
};

/** Bảng (ẩn trên mobile bằng CSS) nên chọn đúng vùng desktop. */
const table = () => screen.getByRole('table');

describe('RfqWorkspace (FR-RFQ-07/08/12)', () => {
  it('chỉ bật "Chốt" ở chào giá đủ số lượng và nêu lý do ở chào giá thiếu', async () => {
    renderVi(await workspace());
    const rows = within(table()).getAllByRole('row').slice(1);
    expect(rows).toHaveLength(4);
    const byName = (name: string) => rows.find((r) => within(r).queryByText(name)) as HTMLElement;
    const full = within(byName('BQL điều phối · 3 hộ')).getByRole('button', { name: 'Chốt' });
    expect((full as HTMLButtonElement).disabled).toBe(false);
    const partial = within(byName('Gốm Minh Hải')).getByRole('button', { name: 'Chốt' });
    expect((partial as HTMLButtonElement).disabled).toBe(true);
    expect(
      within(byName('Gốm Minh Hải')).getByText(/Chỉ chốt được chào giá đủ 5\.000 cốc/),
    ).toBeTruthy();
    expect(within(byName('BQL điều phối · 3 hộ')).getByText('Liên kết BQL')).toBeTruthy();
    expect(within(byName('Lò Đức Phát')).getByText('Bản sửa 2')).toBeTruthy();
  });

  it('tô vàng ô tốt nhất theo cột: đơn giá thấp nhất thuộc chào giá liên kết', async () => {
    renderVi(await workspace());
    const rows = within(table()).getAllByRole('row').slice(1);
    const coop = rows.find((r) => within(r).queryByText('BQL điều phối · 3 hộ')) as HTMLElement;
    expect(within(coop).getAllByText(/tốt nhất/).length).toBeGreaterThanOrEqual(3);
    const lamNgoc = rows.find((r) => within(r).queryByText('Gốm Lam Ngọc')) as HTMLElement;
    expect(within(lamNgoc).queryAllByText(/tốt nhất/)).toHaveLength(0);
  });

  it('chốt qua hộp thoại: RFQ sang ACCEPTED, bid khác bị từ chối, hết nút hành động', async () => {
    renderVi(await workspace());
    const rows = within(table()).getAllByRole('row').slice(1);
    const coop = rows.find((r) => within(r).queryByText('BQL điều phối · 3 hộ')) as HTMLElement;
    fireEvent.click(within(coop).getByRole('button', { name: 'Chốt' }));
    const dialog = openDialog();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Chốt chào giá', hidden: true }));
    expect(screen.getByText('Đã đóng ấn.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Hủy yêu cầu' })).toBeNull();
    expect(within(table()).getAllByText('Không được chọn')).toHaveLength(3);
  });

  it('hủy yêu cầu cần lý do (REASON_REQUIRED), có lý do thì sang CANCELLED', async () => {
    renderVi(await workspace());
    fireEvent.click(screen.getByRole('button', { name: 'Hủy yêu cầu' }));
    const dialog = openDialog();
    const confirm = () => within(dialog).getByRole('button', { name: 'Hủy yêu cầu', hidden: true });
    fireEvent.click(confirm());
    expect(within(dialog).getByRole('alert', { hidden: true }).textContent).toContain(
      'ghi lý do hủy',
    );
    fireEvent.change(within(dialog).getByRole('textbox', { hidden: true }), {
      target: { value: 'Đổi kế hoạch' },
    });
    fireEvent.click(confirm());
    expect(screen.getByText('Yêu cầu đã hủy')).toBeTruthy();
    expect(screen.getByText('Lý do: Đổi kế hoạch')).toBeTruthy();
  });
});
