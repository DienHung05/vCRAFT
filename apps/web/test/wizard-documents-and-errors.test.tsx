import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { AccountApiError } from '@vcraft/api-client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DocumentUpload } from '@/features/auth/document-upload';
import { serverFieldMessageKey } from '@/features/auth/schemas';
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
  getMyDocuments: vi.fn(),
  submitHousehold: vi.fn(),
  uploadCertificate: vi.fn(),
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
  account.getMyDocuments.mockResolvedValue({ data: [] });
});

describe('wizard document step', () => {
  it('lists documents uploaded earlier as done and lets the applicant submit without re-uploading', async () => {
    account.getMyDocuments.mockResolvedValue({
      data: [
        {
          id: '11111111-1111-4111-8111-111111111111',
          mimeType: 'application/pdf',
          caption: 'Giấy phép xưởng',
          certificateKind: 'WORKSHOP',
          sizeBytes: 2048,
          createdAt: '2026-11-01T00:00:00.000Z',
        },
      ],
    });
    account.submitHousehold.mockResolvedValue({});
    const assign = vi.fn();
    vi.stubGlobal('location', { ...window.location, assign });
    renderVi(<DocumentUpload />);
    expect(await screen.findByText('Giấy phép xưởng')).toBeTruthy();
    const submit = screen.getByRole('button', { name: 'Nộp hồ sơ' }) as HTMLButtonElement;
    await waitFor(() => expect(submit.disabled).toBe(false));
    expect(account.uploadCertificate).not.toHaveBeenCalled();
    fireEvent.click(submit);
    await waitFor(() => expect(account.submitHousehold).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(assign).toHaveBeenCalledWith(expect.stringContaining('submitted=1')),
    );
    vi.unstubAllGlobals();
  });

  it('shows a translated alert and stays on the step when the API says the application is incomplete', async () => {
    account.getMyDocuments.mockResolvedValue({
      data: [
        {
          id: '11111111-1111-4111-8111-111111111111',
          mimeType: 'application/pdf',
          caption: null,
          certificateKind: 'IDENTITY',
          sizeBytes: 100,
          createdAt: '2026-11-01T00:00:00.000Z',
        },
      ],
    });
    account.submitHousehold.mockRejectedValue(new AccountApiError('APPLICATION_INCOMPLETE', 422));
    renderEn(<DocumentUpload />);
    const submit = (await screen.findByRole('button', {
      name: 'Submit application',
    })) as HTMLButtonElement;
    await waitFor(() => expect(submit.disabled).toBe(false));
    fireEvent.click(submit);
    expect(await screen.findByText(/still missing a required part/)).toBeTruthy();
  });
});

describe('wizard household step messages', () => {
  it('maps server field errors to translated messages instead of the Vietnamese server text', async () => {
    account.applyHousehold.mockRejectedValue(
      new AccountApiError('VALIDATION_FAILED', 422, [
        { path: 'village', code: 'too_big', message: 'Tên làng dài quá 160 ký tự' },
        { path: 'history', code: 'too_big', message: 'Giới thiệu dài quá' },
      ]),
    );
    renderEn(<WizardHouseholdStep onDone={vi.fn()} />);
    await act(async () => {});
    fireEvent.change(screen.getByLabelText('Household name'), { target: { value: 'Gốm Mai' } });
    fireEvent.change(screen.getByLabelText("Representative's citizen ID number"), {
      target: { value: '079203004567' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save and continue' }));
    expect(await screen.findByText(/village name is too long/)).toBeTruthy();
    expect(screen.getByText(/story is too long/)).toBeTruthy();
    expect(screen.queryByText(/Tên làng dài quá/)).toBeNull();
  });

  it('picks a key per field and falls back to a generic one', () => {
    expect(serverFieldMessageKey('village', 'too_big')).toBe('villageTooLong');
    expect(serverFieldMessageKey('history', 'too_big')).toBe('historyTooLong');
    expect(serverFieldMessageKey('slug', 'invalid_format')).toBe('slugInvalid');
    expect(serverFieldMessageKey('unknown', 'x')).toBe('fieldInvalid');
  });
});
