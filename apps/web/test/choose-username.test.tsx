import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { ChooseUsernameForm } from '@/features/auth/choose-username-form';
import { renderEn } from './render';

vi.mock('@/lib/auth/supabase-browser', () => ({
  browserSupabase: () => ({
    auth: { getSession: async () => ({ data: { session: { access_token: 'verified-session' } } }) },
  }),
}));
const fetcher = vi.fn();
const assign = vi.fn();
beforeEach(() => {
  fetcher.mockReset().mockResolvedValue(new Response('{}', { status: 200 }));
  assign.mockReset();
  vi.stubGlobal('fetch', fetcher);
  vi.stubGlobal('location', { ...window.location, assign });
});

it('lets an existing account choose a username before continuing to its original destination', async () => {
  renderEn(<ChooseUsernameForm next="/en/quotes" />);
  fireEvent.change(screen.getByLabelText('Username'), { target: { value: 'Old.Buyer' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save username' }));
  await waitFor(() =>
    expect(assign).toHaveBeenCalledWith('/auth/continue?locale=en&next=%2Fen%2Fquotes'),
  );
  expect(fetcher).toHaveBeenCalledWith(
    '/api/v1/me/username',
    expect.objectContaining({
      method: 'PUT',
      body: JSON.stringify({ username: 'old.buyer' }),
      headers: { Authorization: 'Bearer verified-session', 'Content-Type': 'application/json' },
    }),
  );
});

it('keeps the form and reports a conflicting username', async () => {
  fetcher.mockResolvedValue(
    new Response(JSON.stringify({ code: 'USERNAME_TAKEN' }), { status: 409 }),
  );
  renderEn(<ChooseUsernameForm next={null} />);
  fireEvent.change(screen.getByLabelText('Username'), { target: { value: 'old.buyer' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save username' }));
  expect((await screen.findByRole('alert')).textContent).toContain(
    'This username is already taken',
  );
  expect(assign).not.toHaveBeenCalled();
});
