import { act, fireEvent, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WizardHouseholdStep } from '@/features/auth/wizard-household-step';
import { renderVi } from './render';

vi.mock('@/i18n/navigation', () => ({
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
  getPathname: ({ href }: { href: string }) => href,
}));
vi.mock('@/lib/notify', () => ({ notify: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));

const account = vi.hoisted(() => ({
  listConsents: vi.fn(),
  recordConsent: vi.fn(),
  applyHousehold: vi.fn(),
  slugAvailability: vi.fn(),
}));
vi.mock('@/lib/auth/supabase-browser', () => ({
  browserAccountClient: () => account,
  browserSupabase: () => null,
}));

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  for (const fn of Object.values(account)) fn.mockReset();
  account.listConsents.mockResolvedValue({
    currentPolicyVersion: '2026-11-01',
    data: [
      { id: 'x', purpose: 'SIGN_UP', policyVersion: '2026-11-01', givenAt: '2026-11-01T00:00:00Z' },
    ],
  });
});
afterEach(() => vi.useRealTimers());

describe('WizardHouseholdStep address check (FR-ART-01)', () => {
  it('checks the generated address 300 ms after typing and offers a free alternative', async () => {
    account.slugAvailability.mockResolvedValue({ available: false, suggestion: 'gom-mai-2' });
    renderVi(<WizardHouseholdStep onDone={vi.fn()} />);
    await act(async () => {});
    fireEvent.change(screen.getByLabelText('Tên hộ'), { target: { value: 'Gốm Mai' } });
    expect(account.slugAvailability).not.toHaveBeenCalled();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });
    expect(account.slugAvailability).toHaveBeenCalledWith('gom-mai');
    expect(await screen.findByText(/Thử “gom-mai-2”/)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Dùng “gom-mai-2”' }));
    expect((screen.getByLabelText('Đường dẫn trang') as HTMLInputElement).value).toBe('gom-mai-2');
  });

  it('says the address is available, and only asks once for rapid typing', async () => {
    account.slugAvailability.mockResolvedValue({ available: true });
    renderVi(<WizardHouseholdStep onDone={vi.fn()} />);
    await act(async () => {});
    const name = screen.getByLabelText('Tên hộ');
    for (const value of ['G', 'Gố', 'Gốm', 'Gốm Mai']) {
      fireEvent.change(name, { target: { value } });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(100);
      });
    }
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });
    expect(account.slugAvailability).toHaveBeenCalledTimes(1);
    expect(await screen.findByText('Địa chỉ này dùng được.')).toBeTruthy();
  });

  it('does not block the form when the check itself fails', async () => {
    account.slugAvailability.mockRejectedValue(new Error('network'));
    renderVi(<WizardHouseholdStep onDone={vi.fn()} />);
    await act(async () => {});
    fireEvent.change(screen.getByLabelText('Tên hộ'), { target: { value: 'Gốm Mai' } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });
    expect(await screen.findByText(/Chưa kiểm tra được địa chỉ/)).toBeTruthy();
    expect(
      (screen.getByRole('button', { name: 'Lưu và tiếp tục' }) as HTMLButtonElement).disabled,
    ).toBe(false);
  });
});
