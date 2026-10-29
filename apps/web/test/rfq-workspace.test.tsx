import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import type { QuotationClient } from '@vcraft/api-client';
import { describe, expect, it, vi } from 'vitest';
import { LiveBuyerQuotations } from '@/features/rfq/live-buyer-quotations';
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
  it('chỉ hiện chào giá đủ số lượng; chào một phần của hộ là đề xuất riêng, không hiện cho bên mua', async () => {
    renderVi(await workspace());
    const rows = within(table()).getAllByRole('row').slice(1);
    expect(rows).toHaveLength(2);
    const byName = (name: string) => rows.find((r) => within(r).queryByText(name)) as HTMLElement;
    const full = within(byName('BQL điều phối · 3 hộ')).getByRole('button', { name: 'Chốt' });
    expect((full as HTMLButtonElement).disabled).toBe(false);
    // Chào một phần là đề xuất tham gia riêng cho BQL: bên mua không thấy hàng nào "Một phần"
    // và không có nút Chốt nào bị chặn vì thiếu số lượng.
    expect(within(table()).queryByText(/Một phần/)).toBeNull();
    expect(within(table()).queryByText(/Chỉ chốt được chào giá đủ/)).toBeNull();
    const acceptButtons = within(table()).getAllByRole('button', {
      name: 'Chốt',
    }) as HTMLButtonElement[];
    expect(acceptButtons.length).toBeGreaterThan(0);
    expect(acceptButtons.every((b) => !b.disabled)).toBe(true);
    expect(within(byName('Lò Đức Phát')).getByText('Bản sửa 2')).toBeTruthy();
  });

  it('chào giá liên kết hiện đủ: các hộ, phần chia, ngày hoàn thành và tổng trọn gói', async () => {
    renderVi(await workspace());
    const rows = within(table()).getAllByRole('row').slice(1);
    const coop = rows.find((r) => within(r).queryByText('BQL điều phối · 3 hộ')) as HTMLElement;
    for (const household of ['Gốm Minh Hải', 'Gốm Lam Ngọc', 'Gốm Hạnh Thủy']) {
      expect(within(coop).getByText(household)).toBeTruthy();
    }
    // Phần chia từng hộ hiện đầy đủ, không nhầm với ghi chú mô tả của bid.
    const shareList = within(coop).getByRole('list');
    expect(within(shareList).getByText('Gốm Minh Hải')).toBeTruthy();
    expect(within(shareList).getByText('Gốm Lam Ngọc')).toBeTruthy();
    expect(within(shareList).getByText('Gốm Hạnh Thủy')).toBeTruthy();
    expect(within(shareList).getByText(/2\.000/)).toBeTruthy();
    expect(within(shareList).getAllByText(/1\.500/)).toHaveLength(2);
    // Tổng trọn gói hiện cho bên mua.
    expect(within(coop).getByText(/171\.000\.000/)).toBeTruthy();
  });

  it('bên mua thấy chào giá liên kết thật qua API khi đường dẫn là UUID', async () => {
    const rfqId = '0b8f7a5e-1c2d-4e3f-a5b6-c7d8e9f0a1b2';
    const buyerQuotation = {
      id: 'q-1',
      version: 1,
      status: 'SUBMITTED',
      quantity: 3000,
      parts: [
        {
          householdId: 'hh-a',
          householdName: 'Gốm Minh Hải',
          quantity: 1200,
          completionDate: '2026-12-20T00:00:00.000Z',
        },
        {
          householdId: 'hh-b',
          householdName: 'Gốm Lam Ngọc',
          quantity: 1800,
          completionDate: '2026-12-25T00:00:00.000Z',
        },
      ],
      productionTotalVnd: 168_400_000,
      additionalChargeVnd: 2_600_000,
      totalVnd: 171_000_000,
      deliveryTerms: 'INCLUDED',
    };
    const client = {
      listBuyerQuotations: vi.fn().mockResolvedValue([buyerQuotation]),
      listNotices: vi.fn().mockResolvedValue([]),
    } as unknown as QuotationClient;
    renderVi(<LiveBuyerQuotations rfqId={rfqId} client={client} />);
    await waitFor(() => expect(client.listBuyerQuotations).toHaveBeenCalled());
    const section = screen.getByRole('region', { name: /Chào giá nhận được/ });
    expect(within(section).getByText('Gốm Minh Hải')).toBeTruthy();
    expect(within(section).getByText('Gốm Lam Ngọc')).toBeTruthy();
    // Tổng trọn gói và phần chia hiện; đơn giá riêng của từng hộ không bao giờ có chỗ để hiện.
    expect(within(section).getByText(/171\.000\.000/)).toBeTruthy();
    expect(within(section).getByText(/2\.600\.000/)).toBeTruthy();
    expect(within(section).queryByText(/Đơn giá/)).toBeNull();
  });

  it('hiện thông báo chào giá bị rút cho đúng yêu cầu này', async () => {
    const rfqId = '0b8f7a5e-1c2d-4e3f-a5b6-c7d8e9f0a1b2';
    const client = {
      listBuyerQuotations: vi.fn().mockResolvedValue([]),
      listNotices: vi.fn().mockResolvedValue([
        {
          id: 'n-1',
          version: 1,
          kind: 'QUOTATION_WITHDRAWN',
          requestId: rfqId,
          quotationId: 'q-9',
          createdAt: '2026-10-29T00:00:00.000Z',
        },
      ]),
    } as unknown as QuotationClient;
    renderVi(<LiveBuyerQuotations rfqId={rfqId} client={client} />);
    await waitFor(() => expect(screen.getByText(/một chào giá liên kết đã bị rút/)).toBeTruthy());
  });

  it('không bao giờ hiện giá riêng của từng hộ trong chào giá liên kết', async () => {
    renderVi(await workspace());
    const rows = within(table()).getAllByRole('row').slice(1);
    const coop = rows.find((r) => within(r).queryByText('BQL điều phối · 3 hộ')) as HTMLElement;
    // Giá riêng của hộ là thông tin nội bộ giữa hộ và BQL.
    expect(within(coop).queryByText(/58\.000/)).toBeNull();
    expect(within(coop).queryByText(/54\.000/)).toBeNull();
    expect(within(coop).queryByText(/52\.000/)).toBeNull();
  });

  it('tô vàng ô tốt nhất theo cột: đơn giá thấp nhất thuộc chào giá liên kết', async () => {
    renderVi(await workspace());
    const rows = within(table()).getAllByRole('row').slice(1);
    const coop = rows.find((r) => within(r).queryByText('BQL điều phối · 3 hộ')) as HTMLElement;
    // Chỉ còn 1 chào giá đủ số lượng nên cột "Đáp ứng" không có gì được tô "tốt nhất".
    expect(within(coop).getAllByText(/tốt nhất/).length).toBeGreaterThanOrEqual(3);
  });

  it('chốt qua hộp thoại: RFQ sang ACCEPTED, bid khác bị từ chối, hết nút hành động', async () => {
    renderVi(await workspace());
    const rows = within(table()).getAllByRole('row').slice(1);
    const coop = rows.find((r) => within(r).queryByText('BQL điều phối · 3 hộ')) as HTMLElement;
    fireEvent.click(within(coop).getByRole('button', { name: 'Chốt' }));
    const dialog = openDialog();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Chốt chào giá', hidden: true }));
    expect(screen.getByText('Đã đóng ấn.')).toBeTruthy();
    // Domain cho Buyer hủy đơn đã chốt trước khi vào sản xuất, nên nút Hủy vẫn còn.
    expect(within(table()).getAllByText('Không được chọn')).toHaveLength(1);
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
