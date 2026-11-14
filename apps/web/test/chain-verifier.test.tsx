import { webcrypto } from 'node:crypto';
import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { JourneyStoryCard } from '@/features/traceability/journey-story-card';
import { getProducts, type LogEntry } from '@/lib/demo/data';
import { renderVi } from './render';

const subtle = webcrypto.subtle as SubtleCrypto;

async function sample(): Promise<{ code: string; log: LogEntry[] }> {
  const product = (await getProducts()).find((p) => p.code === 'BT7K2QXM');
  if (!product) throw new Error('thiếu dữ liệu mẫu');
  return product;
}

function card(code: string, log: LogEntry[], extra: { householdVerified?: boolean } = {}) {
  return (
    <JourneyStoryCard
      productId={code}
      entries={log}
      household="Gốm Minh Hải"
      locale="vi"
      prologue="Mở đầu câu chuyện."
      epilogue="Kết câu chuyện."
      chapters={[]}
      subtle={subtle}
      {...extra}
    />
  );
}

describe('the trust line of the story card (FR-TRC-05)', () => {
  it('đang kiểm rồi báo nhật ký còn nguyên, không nhắc dấu băm, giải thích nằm trong mục mở rộng', async () => {
    const { code, log } = await sample();
    renderVi(card(code, log));
    expect(document.querySelector('[data-state="checking"]')).not.toBeNull();

    await waitFor(() => expect(document.querySelector('[data-state="ok"]')).not.toBeNull());
    expect(screen.getAllByText('Nhật ký được giữ nguyên từ ngày ghi').length).toBeGreaterThan(0);
    expect(screen.getByText('Mở đầu câu chuyện.')).toBeTruthy();
    expect(screen.queryByText(/băm|\bSHA\b|\bhash/i)).toBeNull();
    const details = document.querySelector('details');
    expect(details).not.toBeNull();
    expect(within(details as HTMLElement).getByText('Kiểm chứng thế nào?')).toBeTruthy();
    expect(
      within(details as HTMLElement).getByText(/Điều đó không chứng minh các công đoạn/),
    ).toBeTruthy();
    expect(document.querySelector('[data-chain-alert]')).toBeNull();
  });

  it('hiện nhãn hộ đã được BQL xác minh khi hộ đã duyệt (FR-TRC-04)', async () => {
    const { code, log } = await sample();
    const { unmount } = renderVi(card(code, log, { householdVerified: true }));
    expect(screen.getByText(/Hộ đã được BQL xác minh/)).toBeTruthy();
    unmount();
    renderVi(card(code, log));
    expect(screen.queryByText(/Hộ đã được BQL xác minh/)).toBeNull();
  });

  it('một mốc bị sửa ⇒ cảnh báo nổi bật ở đầu thẻ, chỉ đúng mốc, không đóng ấn', async () => {
    const { code, log } = await sample();
    const tampered = log.map((e, i) => (i === 3 ? { ...e, note: 'Vẽ lam bằng máy in.' } : e));
    renderVi(card(code, tampered));

    await waitFor(() => expect(document.querySelector('[data-state="broken"]')).not.toBeNull());
    const alert = screen.getByRole('alert');
    expect(
      within(alert).getByRole('heading', { name: 'Có dấu hiệu chỉnh sửa nhật ký' }),
    ).toBeTruthy();
    expect(
      within(alert).getByText('Mốc 4 (Vẽ lam) không đạt kiểm tra.', { exact: false }),
    ).toBeTruthy();
    expect(within(alert).getByRole('link', { name: 'Xem mốc 4' }).getAttribute('href')).toBe(
      '#log-4',
    );
    // The warning comes before the kicker, not hidden in the disclosure.
    const section = document.querySelector('#story') as HTMLElement;
    expect(section.firstElementChild).toBe(alert);
    expect(alert.closest('details')).toBeNull();
    expect(screen.queryByText('Nhật ký được giữ nguyên từ ngày ghi')).toBeNull();
    expect(document.querySelector('.animate-stamp')).toBeNull();
  });

  it('nhật ký rỗng không được coi là đã xác minh', async () => {
    renderVi(card('LN4R8TPA', []));
    expect(document.querySelector('[data-state="empty"]')).not.toBeNull();
    expect(screen.getByText('Chưa có nhật ký để kiểm')).toBeTruthy();
    expect(screen.queryByText('Nhật ký được giữ nguyên từ ngày ghi')).toBeNull();
  });
});
