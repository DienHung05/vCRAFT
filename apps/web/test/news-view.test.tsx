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
  useRouter: () => ({ refresh: vi.fn() }),
}));
vi.mock('next/navigation', () => ({
  usePathname: () => '/vi/tin-tuc',
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: vi.fn() }),
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
      sourceName: null,
      sourceUrl: null,
      sourcePublishedAt: null,
      cover: {
        mediaId: '00000000-0000-4000-8000-000000000001',
        url: 'https://cdn.test/cho-gom.webp',
        width: null,
        height: null,
        variants: [],
        alt: 'Quầy gốm dưới ánh đèn',
        altEn: null,
        caption: null,
        credit: {
          title: 'File:Cho-gom.jpg',
          author: 'Tác giả ảnh',
          license: 'CC BY 4.0',
          licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
          sourceUrl: 'https://commons.wikimedia.org/wiki/File:Cho-gom.jpg',
        },
      },
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
      sourceName: null,
      sourceUrl: null,
      sourcePublishedAt: null,
      cover: null,
    },
  ],
  nextCursor: 'abc',
};

describe('NewsView', () => {
  it('shows the cover image without a credit line, and nothing for news without a cover', () => {
    renderVi(<NewsView result={{ status: 'ok', page }} />);
    const [withCover, withoutCover] = within(
      screen.getByRole('list', { name: 'Danh sách tin tức' }),
    ).getAllByRole('listitem') as [HTMLElement, HTMLElement];
    expect(within(withCover).getByRole('img', { name: 'Quầy gốm dưới ánh đèn' })).toBeTruthy();
    expect(withCover.querySelector('img')?.getAttribute('src')).toBe(
      'https://cdn.test/cho-gom.webp',
    );
    // Credits live on /ghi-nhan-anh only (GH#204).
    expect(within(withCover).queryByText(/Tác giả ảnh/)).toBeNull();
    expect(within(withCover).queryByRole('link', { name: 'CC BY 4.0' })).toBeNull();
    expect(withoutCover.querySelector('img')).toBeNull();
    expect(within(withoutCover).queryByRole('img')).toBeNull();
  });

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

  it('shows a source line linking to the original story, and nothing for items without a source', () => {
    const sourced: NewsListDto = {
      ...page,
      data: [
        {
          ...(page.data[0] as NewsListDto['data'][number]),
          sourceName: 'Hà Nội Mới',
          sourceUrl: 'https://hanoimoi.vn/bai-viet',
          sourcePublishedAt: '2026-08-29T05:00:00.000Z',
        },
        page.data[1] as NewsListDto['data'][number],
      ],
    };
    renderVi(<NewsView result={{ status: 'ok', page: sourced }} />);
    const items = within(screen.getByRole('list', { name: 'Danh sách tin tức' })).getAllByRole(
      'listitem',
    );
    const link = within(items[0] as HTMLElement).getByRole('link', {
      name: /^Nguồn: Hà Nội Mới, /,
    });
    expect(link.getAttribute('href')).toBe('https://hanoimoi.vn/bai-viet');
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toBe('noopener nofollow');
    expect(within(items[1] as HTMLElement).queryByText(/Nguồn:/)).toBeNull();
    // The admin-only origin never reaches visitors.
    expect(document.body.textContent).not.toMatch(/IMPORTED|GENERATED|Nhập tự động|Bài tự sinh/);
  });

  it('links to the next page by cursor, keeping the household filter', () => {
    renderVi(<NewsView result={{ status: 'ok', page }} householdSlug="gom-minh-hai" />);
    const more = screen.getByRole('link', { name: /Xem thêm tin/ });
    expect(more.getAttribute('href')).toContain('cursor=abc');
    expect(more.getAttribute('href')).toContain('household=gom-minh-hai');
    expect(screen.getByText(/Đang xem tin của Gốm Minh Hải/)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Xem mọi tin' })).toBeTruthy();
  });

  it('shows the numbered page bar instead of the cursor link when the page has totals (GH#202)', () => {
    renderVi(
      <NewsView
        result={{
          status: 'ok',
          page: { ...page, nextCursor: null, page: 1, pageSize: 12, total: 30, totalPages: 3 },
        }}
      />,
    );
    expect(screen.getByRole('navigation', { name: 'Phân trang tin tức' })).toBeTruthy();
    expect(screen.getByText('30 tin')).toBeTruthy();
    expect(screen.queryByRole('link', { name: /Xem thêm tin/ })).toBeNull();
  });

  it('shows an empty state when there is no news', () => {
    const result: NewsResult = { status: 'ok', page: { data: [], nextCursor: null } };
    renderVi(<NewsView result={result} />);
    expect(screen.getByText('Chưa có tin nào.')).toBeTruthy();
    expect(screen.queryByRole('list')).toBeNull();
    expect(screen.queryByRole('link', { name: /Xem thêm tin/ })).toBeNull();
  });

  it('shows an error with a retry button instead of failing when the API is unavailable', () => {
    renderVi(<NewsView result={{ status: 'unavailable' }} />);
    expect(screen.getByRole('alert').textContent).toMatch(/Chưa tải được tin tức/);
    expect(screen.getByRole('button', { name: 'Thử lại' })).toBeTruthy();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.queryByRole('list')).toBeNull();
  });
});
