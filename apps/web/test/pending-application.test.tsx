import { fireEvent, screen, waitFor } from '@testing-library/react';
import type { StudioClient } from '@vcraft/api-client';
import { beforeEach, expect, it, vi } from 'vitest';
import { PendingApplicationEditor } from '@/features/auth/pending-application-editor';
import { ResubmitApplication } from '@/features/auth/resubmit-application';
import { renderVi } from './render';

const account = vi.hoisted(() => ({
  getMyHousehold: vi.fn(),
  resubmitHousehold: vi.fn(),
  getMyDocuments: vi.fn(async () => ({ data: [] })),
}));
vi.mock('@vcraft/api-client', async (original) => ({
  ...(await original<typeof import('@vcraft/api-client')>()),
  createAccountClient: () => account,
}));
vi.mock('@/lib/api/live-session', async (original) => ({
  ...(await original<typeof import('@/lib/api/live-session')>()),
  browserAccessToken: () => async () => 'local-test-token',
}));
vi.mock('@/features/studio/workshop-editor', () => ({
  inputClass: '',
  WorkshopEditor: () => null,
}));
vi.mock('@/lib/notify', () => ({ notify: { success: vi.fn() } }));
vi.mock('@/i18n/navigation', () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a href="/">{children}</a>,
}));

beforeEach(() => vi.clearAllMocks());

it('lets a pending applicant save corrections and choose classified private evidence', async () => {
  let household = {
    id: 'household',
    status: 'PENDING_REVIEW',
    version: 4,
    history: 'Old story',
    craft: null,
    village: null,
    foundedYear: null,
    workshops: [],
    idNumberMasked: null,
  };
  const updateProfile = vi.fn(async (version: number, body: { history: string }) => {
    expect(version).toBe(4);
    household = { ...household, ...body, version: 5 };
    return household;
  });
  const client = { getHousehold: async () => household, updateProfile } as unknown as StudioClient;
  renderVi(<PendingApplicationEditor client={client} />);
  fireEvent.change(await screen.findByLabelText('Câu chuyện của hộ'), {
    target: { value: 'Corrected story' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Lưu thay đổi' }));
  await waitFor(() =>
    expect(updateProfile).toHaveBeenCalledWith(
      4,
      expect.objectContaining({ history: 'Corrected story' }),
    ),
  );
  expect(screen.getByLabelText('Giấy tờ này là')).toBeDefined();
  expect(screen.queryByRole('button', { name: 'Gửi hồ sơ' })).toBeNull();
});

it('loads the current private household version before explicitly resubmitting saved edits', async () => {
  account.getMyHousehold.mockResolvedValue({
    id: 'household',
    status: 'PENDING_REVIEW',
    version: 8,
  });
  account.resubmitHousehold.mockResolvedValue({ version: 9, reviewState: 'RESUBMITTED' });
  renderVi(<ResubmitApplication householdId="household" />);
  fireEvent.click(screen.getByRole('button', { name: 'Gửi lại hồ sơ' }));
  await waitFor(() => expect(account.resubmitHousehold).toHaveBeenCalledWith(8));
});
