import { screen, within } from '@testing-library/react';
import type { NewsListDto } from '@vcraft/contracts';
import { describe, expect, it, vi } from 'vitest';
import type { NewsResult } from '@/features/news/news-api';
import { NewsView } from '@/features/news/news-view';
import { renderVi } from './render';

// `next-intl/navigation` cần runtime Next; thay bằng thẻ <a> giữ nguyên pathname và query để kiểm href.
vi.mock('@/i18n/navigation', () => ({
  Link: ({
    href,
    children,
    ...rest
  }: {
    href: string | { pathname: string; query?: Record<string, string> };
    children: React.ReactNode;
  }) => (
    <a
      href={
        typeof href === 'string'
          ? href
          : `${href.pathname}${href.query ? `?${new URLSearchParams(href.query)}` : ''}`
      }
      {...rest}
    >
      {children}
    </a>
  ),
}));

const page: NewsListDto = {
  data: [
    {
      slug: 'cho-gom-dem',
      title: 'Chợ gốm đêm trở lại',
      summary: 'Mở cửa tối thứ Sáu và thứ Bảy.',
      category: 'VILLAGE_EVENT',
      pinned: true,
      publishedAt: '2026-08-30T03:00:00.000Z',
      householdName: null,
      householdSlug: null,
    },
    {
      slug: 'men-lam',
      title: 'Men lam của Gốm Minh Hải',
      summary: 'Ba mươi mẻ nung thử.',
      category: 'CRAFT_STORY',
      pinned: false,
      publishedAt: '2026-08-27T03:00:00.000Z',
      householdName: 'Gốm Minh Hải',
      householdSlug: 'gom-minh-hai',
    },
  ],
  nextCursor: 'abc',
};

describe('NewsView', () => {
  it('renders one h1 and a list with pinned badge, category, household and village labels', () => {
    renderVi(<NewsView result={{ status: 'ok', page }} />);
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    const items = within(screen.getByRole('list', { name: 'Danh sách tin tức' })).getAllByRole(
      'listitem',
    );
    expect(items).toHaveLength(2);
    expect(within(items[0] as HTMLElement).getByText('Tin ghim')).toBeTruthy();
    expect(within(items[0] as HTMLElement).getByText('Sự kiện làng')).toBeTruthy();
    expect(within(items[0] as HTMLElement).getByText('Tin chung của làng')).toBeTruthy();
    expect(within(items[0] as HTMLElement).getByRole('heading', { level: 2 }).textContent).toBe(
      'Chợ gốm đêm trở lại',
    );
    const household = within(items[1] as HTMLElement).getByRole('link', {
      name: 'Từ Gốm Minh Hải',
    });
    expect(household.getAttribute('href')).toContain('household=gom-minh-hai');
    expect(items[0]?.querySelector('time')?.getAttribute('datetime')).toBe(
      '2026-08-30T03:00:00.000Z',
    );
  });

  it('links to the next page by cursor, keeping the household filter', () => {
    renderVi(<NewsView result={{ status: 'ok', page }} householdSlug="gom-minh-hai" />);
    const more = screen.getByRole('link', { name: /Xem thêm tin/ });
    expect(more.getAttribute('href')).toContain('cursor=abc');
    expect(more.getAttribute('href')).toContain('household=gom-minh-hai');
    expect(screen.getByText(/Đang xem tin của Gốm Minh Hải/)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Xem mọi tin' })).toBeTruthy();
  });

  it('shows an empty state when there is no news', () => {
    const result: NewsResult = { status: 'ok', page: { data: [], nextCursor: null } };
    renderVi(<NewsView result={result} />);
    expect(screen.getByText('Chưa có tin nào.')).toBeTruthy();
    expect(screen.queryByRole('list')).toBeNull();
    expect(screen.queryByRole('link', { name: /Xem thêm tin/ })).toBeNull();
  });

  it('shows a status message instead of failing when the API is unavailable', () => {
    renderVi(<NewsView result={{ status: 'unavailable' }} />);
    expect(screen.getByRole('status').textContent).toMatch(/Chưa tải được tin tức/);
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.queryByRole('list')).toBeNull();
  });
});
