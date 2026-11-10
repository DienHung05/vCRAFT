import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WizardHouseholdStep } from '@/features/auth/wizard-household-step';
import { renderEn, renderVi } from './render';

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
}));
vi.mock('@/lib/auth/supabase-browser', () => ({
  browserAccountClient: () => account,
  browserSupabase: () => null,
}));

const POLICY = '2026-11-01';

beforeEach(() => {
  for (const fn of Object.values(account)) fn.mockReset();
  account.listConsents.mockResolvedValue({
    currentPolicyVersion: POLICY,
    data: [
      { id: 'x', purpose: 'SIGN_UP', policyVersion: POLICY, givenAt: '2026-11-01T00:00:00Z' },
      { id: 'y', purpose: 'ID_DOCUMENT', policyVersion: POLICY, givenAt: '2026-11-01T00:00:00Z' },
    ],
  });
  account.applyHousehold.mockResolvedValue({});
});

const fill = (idNumber: string) => {
  fireEvent.change(screen.getByLabelText('Tên hộ'), { target: { value: 'Gốm Mai' } });
  fireEvent.change(screen.getByLabelText('Số CCCD của người đại diện'), {
    target: { value: idNumber },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Lưu và tiếp tục' }));
};

describe('WizardHouseholdStep citizen ID number', () => {
  it('requires exactly 12 digits before anything is sent', async () => {
    renderVi(<WizardHouseholdStep onDone={vi.fn()} />);
    await act(async () => {});
    for (const bad of ['', '12345678901', '1234567890123', '07920300456x']) {
      fill(bad);
      expect(await screen.findByText(/đúng 12 chữ số/)).toBeTruthy();
    }
    expect(account.applyHousehold).not.toHaveBeenCalled();
  });

  it('sends the number with the application when it is valid', async () => {
    const done = vi.fn();
    renderVi(<WizardHouseholdStep onDone={done} />);
    await act(async () => {});
    fill('079203004567');
    await waitFor(() => expect(done).toHaveBeenCalled());
    expect(account.applyHousehold).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Gốm Mai', idNumber: '079203004567' }),
    );
  });

  it('explains in the hint that the number is encrypted, in English too', async () => {
    renderEn(<WizardHouseholdStep onDone={vi.fn()} />);
    await act(async () => {});
    expect(screen.getByLabelText("Representative's citizen ID number")).toBeTruthy();
    expect(screen.getByText(/It is encrypted when saved/)).toBeTruthy();
  });

  it('uses a numeric keypad and does not autofill', async () => {
    renderVi(<WizardHouseholdStep onDone={vi.fn()} />);
    await act(async () => {});
    const input = screen.getByLabelText('Số CCCD của người đại diện') as HTMLInputElement;
    expect(input.inputMode).toBe('numeric');
    expect(input.autocomplete).toBe('off');
    expect(input.maxLength).toBe(12);
  });
});
