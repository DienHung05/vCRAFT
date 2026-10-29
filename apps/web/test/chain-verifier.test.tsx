import { webcrypto } from 'node:crypto';
import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ChainVerifier } from '@/features/traceability/chain-verifier';
import { getProducts, type LogEntry } from '@/lib/demo/data';
import { renderVi } from './render';

const subtle = webcrypto.subtle as SubtleCrypto;

async function sample(): Promise<{ code: string; log: LogEntry[] }> {
  const product = (await getProducts()).find((p) => p.code === 'BT7K2QXM');
  if (!product) throw new Error('thiếu dữ liệu mẫu');
  return product;
}

describe('ChainVerifier (FR-TRC-05)', () => {
  it('đang kiểm rồi báo toàn vẹn khi chuỗi đúng, kèm nhãn demo và câu phân biệt', async () => {
    const { code, log } = await sample();
    renderVi(
      <ChainVerifier productId={code} entries={log} household="Gốm Minh Hải" subtle={subtle} />,
    );
    expect(document.querySelector('[data-state="checking"]')).not.toBeNull();

    await waitFor(() => expect(document.querySelector('[data-state="ok"]')).not.toBeNull());
    expect(screen.getByRole('heading', { name: 'Nhật ký toàn vẹn' })).toBeTruthy();
    expect(screen.getByText(/Chuỗi nhật ký toàn vẹn · 8 mốc/)).toBeTruthy();
    expect(screen.getByText('Dữ liệu minh họa')).toBeTruthy();
    expect(
      screen.getByText(/^Toàn vẹn nhật ký: nhật ký này không bị âm thầm thay đổi/),
    ).toBeTruthy();
  });

  it('một mốc bị sửa ⇒ báo lỗi, chỉ đúng mốc và không đóng ấn xác thực', async () => {
    const { code, log } = await sample();
    const tampered = log.map((e, i) => (i === 3 ? { ...e, note: 'Vẽ lam bằng máy in.' } : e));
    renderVi(
      <ChainVerifier
        productId={code}
        entries={tampered}
        household="Gốm Minh Hải"
        subtle={subtle}
      />,
    );

    await waitFor(() => expect(document.querySelector('[data-state="broken"]')).not.toBeNull());
    expect(screen.getByRole('heading', { name: 'Có dấu hiệu chỉnh sửa nhật ký' })).toBeTruthy();
    expect(screen.getByText('Mốc 4 (Vẽ lam) không đạt kiểm tra.')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Xem mốc 4' }).getAttribute('href')).toBe('#log-4');
    expect(screen.queryByText(/Chuỗi nhật ký toàn vẹn/)).toBeNull();
    expect(document.querySelector('.animate-stamp')).toBeNull();
  });

  it('nhật ký rỗng không được coi là đã xác minh', async () => {
    renderVi(
      <ChainVerifier productId="LN4R8TPA" entries={[]} household="Gốm Lam Ngọc" subtle={subtle} />,
    );
    expect(document.querySelector('[data-state="empty"]')).not.toBeNull();
    expect(screen.getByRole('heading', { name: 'Chưa có nhật ký để kiểm' })).toBeTruthy();
  });
});
