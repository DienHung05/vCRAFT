// @vitest-environment node
import type { NextRequest } from 'next/server';
import { beforeEach, expect, it, vi } from 'vitest';
import { GET } from '@/app/auth/continue/route';

const { getViewer } = vi.hoisted(() => ({ getViewer: vi.fn() }));
vi.mock('@/lib/auth/viewer', () => ({ getViewer }));
vi.mock('@/lib/auth/supabase-server', () => ({ createServerSupabase: async () => null }));
vi.mock('@/i18n/navigation', () => ({
  getPathname: ({ href, locale }: { href: string; locale: string }) =>
    `/${locale}${href === '/chon-ten-dang-nhap' && locale === 'en' ? '/choose-username' : href}`,
}));

const request = (query: string) =>
  ({ nextUrl: new URL(`http://localhost/auth/continue?${query}`) }) as unknown as NextRequest;
beforeEach(() => getViewer.mockReset());

it('prompts an existing account before following a return path', async () => {
  getViewer.mockResolvedValue({ username: null, role: 'BUYER', household: null });
  const response = await GET(request('locale=en&next=%2Fen%2Fquotes'));
  expect(response.headers.get('location')).toBe('/en/choose-username?next=%2Fen%2Fquotes');
});

it('continues to the original destination after choosing a username', async () => {
  getViewer.mockResolvedValue({ username: 'pottery.buyer', role: 'BUYER', household: null });
  const response = await GET(request('locale=en&next=%2Fen%2Fquotes'));
  expect(response.headers.get('location')).toBe('/en/quotes');
});

it('discards an external return path while prompting for a username', async () => {
  getViewer.mockResolvedValue({ username: null, role: 'BUYER', household: null });
  const response = await GET(request('locale=en&next=https%3A%2F%2Fevil.example'));
  expect(response.headers.get('location')).toBe('/en/choose-username');
});
