import { render, screen } from '@testing-library/react';
import { messages } from '@vcraft/i18n';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Forbidden from '@/app/[locale]/forbidden';

let viewer: { email: string; role: string; status: string } | null = null;
vi.mock('@/lib/auth/viewer', () => ({ getViewer: async () => viewer }));
vi.mock('@/components/shell/public-shell', () => ({
  PublicShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock('@/features/auth/sign-out-button', () => ({
  SignOutToSignInButton: ({ children }: { children: React.ReactNode }) => (
    <button type="button">{children}</button>
  ),
}));
vi.mock('next-intl/server', async () => {
  const { createTranslator } = await import('next-intl');
  return {
    getTranslations: async (namespace: string) =>
      createTranslator({ locale: 'vi', messages: messages.vi, namespace } as never),
  };
});
vi.mock('@/i18n/navigation', () => ({
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

async function show() {
  const ui = await Forbidden();
  render(
    <NextIntlClientProvider locale="vi" messages={messages.vi}>
      {ui}
    </NextIntlClientProvider>,
  );
}

beforeEach(() => {
  viewer = null;
});

describe('Forbidden page', () => {
  it('gives a household on the buyer area a link to its own area', async () => {
    viewer = { email: 'h@x.vn', role: 'HOUSEHOLD', status: 'ACTIVE' };
    await show();
    expect(screen.getByRole('link', { name: 'Đến Hồ sơ hộ' }).getAttribute('href')).toBe(
      '/studio/ho-so',
    );
  });

  it('gives an administrator a link to the admin area', async () => {
    viewer = { email: 'a@x.vn', role: 'ADMIN', status: 'ACTIVE' };
    await show();
    expect(screen.getByRole('link', { name: 'Đến Điều phối' }).getAttribute('href')).toBe('/admin');
  });

  it('offers no area link to a guest or a locked account', async () => {
    await show();
    expect(screen.queryByRole('link', { name: /^Đến / })).toBeNull();
  });
});
