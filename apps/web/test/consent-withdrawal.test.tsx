import { fireEvent, screen, waitFor } from '@testing-library/react';
import type { AccountClient } from '@vcraft/api-client';
import type { ConsentDto } from '@vcraft/contracts';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConsentWithdrawalCard } from '@/features/account/consent-withdrawal';
import { confirmDialog, openDialog } from './confirm';
import { renderEn, renderVi } from './render';

const notifySuccess = vi.hoisted(() => vi.fn());
vi.mock('@/lib/notify', () => ({
  notify: { success: notifySuccess, error: vi.fn(), info: vi.fn() },
}));
vi.mock('@/lib/auth/supabase-browser', () => ({
  browserAccountClient: () => {
    throw new Error('not used');
  },
}));

const row = (purpose: ConsentDto['purpose'], withdrawnAt: string | null = null): ConsentDto => ({
  id: crypto.randomUUID(),
  purpose,
  policyVersion: '2026-11-01',
  givenAt: '2026-11-01T08:00:00.000Z',
  withdrawnAt,
});
const ALL = [row('SIGN_UP'), row('ID_DOCUMENT'), row('RFQ_CONTACT'), row('MAKER_PROFILE')];

function api(overrides: Partial<AccountClient> = {}): AccountClient {
  return {
    listConsents: vi.fn(async () => ({ currentPolicyVersion: '2026-11-01', data: ALL })),
    withdrawConsent: vi.fn(async () => ({
      currentPolicyVersion: '2026-11-01',
      data: ALL.map((c) =>
        c.purpose === 'ID_DOCUMENT' ? { ...c, withdrawnAt: '2026-11-10T08:00:00.000Z' } : c,
      ),
    })),
    ...overrides,
  } as unknown as AccountClient;
}

beforeEach(() => notifySuccess.mockReset());

describe('ConsentWithdrawalCard', () => {
  it('lists withdrawable purposes, never SIGN_UP, with what stops working', async () => {
    renderEn(<ConsentWithdrawalCard client={api()} />);
    expect(await screen.findAllByRole('button', { name: /^Withdraw:/ })).toHaveLength(3);
    expect(screen.getByText(/cannot upload more papers/)).toBeTruthy();
    expect(screen.getByText(/cannot be withdrawn on its own/)).toBeTruthy();
  });

  it('asks for confirmation, then withdraws and drops the purpose from the list', async () => {
    const client = api();
    renderVi(<ConsentWithdrawalCard client={client} />);
    const buttons = await screen.findAllByRole('button', { name: /^Rút lại:/ });
    fireEvent.click(buttons[0] as HTMLElement);
    expect(client.withdrawConsent).not.toHaveBeenCalled();
    expect(openDialog().textContent).toContain('Giấy tờ xác minh và số CCCD');
    confirmDialog('Rút lại sự đồng ý');
    await waitFor(() => expect(client.withdrawConsent).toHaveBeenCalledWith('ID_DOCUMENT'));
    await waitFor(() =>
      expect(screen.getAllByRole('button', { name: /^Rút lại:/ })).toHaveLength(2),
    );
    expect(notifySuccess).toHaveBeenCalledWith('Đã rút lại sự đồng ý.');
  });

  it('keeps the dialog open and says so when withdrawing fails', async () => {
    const client = api({ withdrawConsent: vi.fn().mockRejectedValue(new Error('down')) });
    renderEn(<ConsentWithdrawalCard client={client} />);
    fireEvent.click(
      (await screen.findAllByRole('button', { name: /^Withdraw:/ }))[0] as HTMLElement,
    );
    confirmDialog('Withdraw consent');
    await waitFor(() => expect(openDialog().textContent).toContain('could not be withdrawn'));
  });

  it('says there is nothing to withdraw when no consent stands', async () => {
    const client = api({
      listConsents: vi.fn(async () => ({
        currentPolicyVersion: '2026-11-01',
        data: [row('SIGN_UP')],
      })),
    });
    renderEn(<ConsentWithdrawalCard client={client} />);
    expect(await screen.findByText('You have no active consent to withdraw.')).toBeTruthy();
  });
});
