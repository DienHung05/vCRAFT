import { act, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import TracePage, { generateMetadata } from '@/app/[locale]/truy-xuat/[code]/page';
import { renderVi } from './render';

vi.mock('next-intl/server', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next-intl/server')>()),
  getTranslations: async () => (key: string) => key,
}));
vi.mock('@/lib/locale', () => ({ resolveLocale: vi.fn(async () => 'vi') }));
vi.mock('@/features/catalog/exhibition-api', () => ({
  fetchTrace: vi.fn(),
  fetchHousehold: vi.fn(),
}));
vi.mock('@/components/shell/locale-switcher', () => ({ LocaleSwitcher: () => null }));
vi.mock('@/components/retry-link', () => ({
  RetryLink: () => <button type="button">retry</button>,
}));
vi.mock('@/i18n/navigation', () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a href="/x">{children}</a>,
}));

const { fetchTrace } = await import('@/features/catalog/exhibition-api');

const CODE = 'AB23CD45';
const props = { params: Promise.resolve({ locale: 'vi', code: CODE }) } as never;

beforeEach(() => {
  vi.clearAllMocks();
});

describe('trace page when the API fails', () => {
  it('renders the unavailable block with an h1 instead of the unverified warning', async () => {
    vi.mocked(fetchTrace).mockResolvedValue({ status: 'unavailable' } as never);
    const element = await TracePage(props);
    await act(async () => {
      renderVi(element);
    });
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('title');
    expect(screen.getByText('retry')).toBeTruthy();
    expect(screen.queryByText('notFoundTitle')).toBeNull();
  });

  it('keeps the error page out of search results', async () => {
    vi.mocked(fetchTrace).mockResolvedValue({ status: 'unavailable' } as never);
    expect(await generateMetadata(props)).toEqual({ robots: { index: false } });
  });

  it('still shows the unverified warning for an unknown code (FR-TRC-08)', async () => {
    vi.mocked(fetchTrace).mockResolvedValue({ status: 'not-found' } as never);
    const element = await TracePage(props);
    await act(async () => {
      renderVi(element);
    });
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('notFoundTitle');
    expect(screen.queryByText('retry')).toBeNull();
    expect(await generateMetadata(props)).toEqual({ title: CODE, robots: { index: false } });
  });
});
