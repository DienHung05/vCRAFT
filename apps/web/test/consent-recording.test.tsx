import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { AccountApiError } from '@vcraft/api-client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DocumentUpload } from '@/features/auth/document-upload';
import { WizardHouseholdStep } from '@/features/auth/wizard-household-step';
import { renderVi } from './render';

vi.mock('@/i18n/navigation', () => ({
  Link: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
  getPathname: ({ href }: { href: string }) => href,
}));
vi.mock('@/lib/notify', () => ({ notify: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));

const account = vi.hoisted(() => ({
  listConsents: vi.fn(),
  recordConsent: vi.fn(),
  applyHousehold: vi.fn(),
  uploadCertificate: vi.fn(),
  getMyDocuments: vi.fn(),
}));
vi.mock('@/lib/auth/supabase-browser', () => ({
  browserAccountClient: () => account,
  browserSupabase: () => null,
}));

const POLICY = '2026-11-01';

beforeEach(() => {
  for (const fn of Object.values(account)) fn.mockReset();
  account.recordConsent.mockResolvedValue({});
  account.applyHousehold.mockResolvedValue({});
  account.uploadCertificate.mockResolvedValue({});
  account.getMyDocuments.mockResolvedValue({ data: [] });
});

describe('WizardHouseholdStep consent', () => {
  const fillName = () => {
    fireEvent.change(screen.getByLabelText('Tên hộ'), { target: { value: 'Gốm Mai' } });
    fireEvent.change(screen.getByLabelText('Số CCCD của người đại diện'), {
      target: { value: '079203004567' },
    });
  };

  it('asks for consent when none is on record, records it, then applies', async () => {
    account.listConsents.mockResolvedValue({ currentPolicyVersion: POLICY, data: [] });
    const done = vi.fn();
    renderVi(<WizardHouseholdStep onDone={done} />);
    const box = await screen.findByRole('checkbox', { name: /Chính sách quyền riêng tư/ });
    fillName();

    fireEvent.click(screen.getByRole('button', { name: 'Lưu và tiếp tục' }));
    expect(await screen.findByText(/Hãy đồng ý với Chính sách quyền riêng tư/)).toBeTruthy();
    expect(account.applyHousehold).not.toHaveBeenCalled();
    expect(account.recordConsent).not.toHaveBeenCalled();

    fireEvent.click(box);
    fireEvent.click(screen.getByRole('button', { name: 'Lưu và tiếp tục' }));
    await waitFor(() => expect(done).toHaveBeenCalled());
    expect(account.recordConsent).toHaveBeenCalledWith('SIGN_UP', POLICY);
    expect(account.recordConsent.mock.invocationCallOrder[0]).toBeLessThan(
      account.applyHousehold.mock.invocationCallOrder[0] ?? 0,
    );
  });

  it('does not ask again when the sign-up consent is already on record', async () => {
    account.listConsents.mockResolvedValue({
      currentPolicyVersion: POLICY,
      data: [
        { id: 'x', purpose: 'SIGN_UP', policyVersion: POLICY, givenAt: '2026-11-01T00:00:00Z' },
      ],
    });
    const done = vi.fn();
    renderVi(<WizardHouseholdStep onDone={done} />);
    await waitFor(() => expect(account.listConsents).toHaveBeenCalled());
    await act(async () => {});
    expect(screen.queryByRole('checkbox')).toBeNull();
    fillName();
    fireEvent.click(screen.getByRole('button', { name: 'Lưu và tiếp tục' }));
    await waitFor(() => expect(done).toHaveBeenCalled());
    expect(account.recordConsent).not.toHaveBeenCalled();
  });

  it('explains a CONSENT_REQUIRED answer from the API', async () => {
    account.listConsents.mockResolvedValue({
      currentPolicyVersion: POLICY,
      data: [
        { id: 'x', purpose: 'SIGN_UP', policyVersion: POLICY, givenAt: '2026-11-01T00:00:00Z' },
      ],
    });
    account.applyHousehold.mockRejectedValue(new AccountApiError('CONSENT_REQUIRED', 403));
    renderVi(<WizardHouseholdStep onDone={vi.fn()} />);
    await act(async () => {});
    fillName();
    fireEvent.click(screen.getByRole('button', { name: 'Lưu và tiếp tục' }));
    expect((await screen.findByRole('alert')).textContent).toContain(
      'Cần đồng ý với Chính sách quyền riêng tư',
    );
  });
});

describe('DocumentUpload consent', () => {
  it('records the identity-document consent before the first file is uploaded, once', async () => {
    renderVi(<DocumentUpload />);
    fireEvent.click(screen.getByRole('checkbox', { name: /Chính sách quyền riêng tư/ }));
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = (name: string) => new File(['%PDF'], name, { type: 'application/pdf' });
    fireEvent.change(input, { target: { files: [file('a.pdf'), file('b.pdf')] } });
    await waitFor(() => expect(account.uploadCertificate).toHaveBeenCalledTimes(2));
    expect(account.recordConsent).toHaveBeenCalledTimes(1);
    expect(account.recordConsent).toHaveBeenCalledWith('ID_DOCUMENT', POLICY);
    expect(account.recordConsent.mock.invocationCallOrder[0]).toBeLessThan(
      account.uploadCertificate.mock.invocationCallOrder[0] ?? 0,
    );
  });

  it('does not upload when the consent could not be recorded, and can try again', async () => {
    account.recordConsent.mockRejectedValueOnce(new AccountApiError('INTERNAL_ERROR', 500));
    renderVi(<DocumentUpload />);
    fireEvent.click(screen.getByRole('checkbox', { name: /Chính sách quyền riêng tư/ }));
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, {
      target: { files: [new File(['%PDF'], 'a.pdf', { type: 'application/pdf' })] },
    });
    await screen.findByRole('button', { name: 'Thử lại' });
    expect(account.uploadCertificate).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
    await waitFor(() => expect(account.uploadCertificate).toHaveBeenCalledTimes(1));
    expect(account.recordConsent).toHaveBeenCalledTimes(2);
  });
});
