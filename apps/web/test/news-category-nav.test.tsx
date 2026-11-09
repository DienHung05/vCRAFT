import { screen, within } from '@testing-library/react';
import type { NewsListDto } from '@vcraft/contracts';
import { describe, expect, it, vi } from 'vitest';
import { NewsView } from '@/features/news/news-view';
import { renderEn, renderVi } from './render';

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
      {...rest}
      href={
        typeof href === 'string'
          ? href
          : `${href.pathname}${href.query ? `?${new URLSearchParams(href.query)}` : ''}`
      }
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
      slug: 'chuong-gom-moi',
      title: 'Chương gốm mới của làng',
      summary: 'Tóm tắt.',
      category: 'CRAFT_STORY',
      pinned: false,
      publishedAt: '2026-11-01T03:00:00.000Z',
      householdName: null,
      householdSlug: null,
      sourceName: null,
      sourceUrl: null,
      sourcePublishedAt: null,
      cover: null,
    },
  ],
  nextCursor: null,
};

/** Nhãn tiếng Việt hiện có trong từ điển `indexPages.news.categories`. */
const CATEGORIES: ReadonlyArray<readonly [string, string]> = [
  ['HOUSEHOLD_UPDATE', 'Từ hộ làng nghề'],
  ['VILLAGE_EVENT', 'Sự kiện làng'],
  ['CRAFT_STORY', 'Chuyện nghề'],
  ['MATERIAL_PRICES', 'Giá nguyên vật liệu'],
  ['POWER_SCHEDULE', 'Lịch cúp điện'],
  ['SUPPORT_POLICY', 'Chính sách hỗ trợ'],
  ['GENERAL', 'Tin chung'],
];

/** vCRAFT-56i.2: trang tin công khai phải có điều hướng phân loại đã dịch. */
describe('NewsView category navigation (vCRAFT-56i.2)', () => {
  it('marks the selected category and resets pagination while keeping the household', () => {
    renderVi(
      <NewsView
        result={{ status: 'ok', page }}
        category="CRAFT_STORY"
        householdSlug="gom-minh-hai"
      />,
    );
    const nav = screen.getByRole('navigation', { name: 'Phân loại tin' });
    expect(
      within(nav).getByRole('link', { name: 'Chuyện nghề' }).getAttribute('aria-current'),
    ).toBe('page');
    const all = within(nav).getByRole('link', { name: 'Tất cả tin' });
    expect(all.getAttribute('aria-current')).toBeNull();
    const query = new URL(all.getAttribute('href') ?? '', 'https://test.invalid').searchParams;
    expect(query.get('household')).toBe('gom-minh-hai');
    expect(query.has('category')).toBe(false);
    expect(query.has('page')).toBe(false);
    expect(query.has('cursor')).toBe(false);
  });

  it('keeps the selected category in the cursor fallback', () => {
    renderVi(
      <NewsView
        result={{ status: 'ok', page: { ...page, nextCursor: 'next' } }}
        category="CRAFT_STORY"
      />,
    );
    expect(screen.getByRole('link', { name: /Xem thêm tin/ }).getAttribute('href')).toContain(
      'category=CRAFT_STORY',
    );
  });

  it.each(['empty', 'unavailable'] as const)(
    'keeps category controls available when %s',
    (state) => {
      renderEn(
        <NewsView
          result={
            state === 'empty'
              ? { status: 'ok', page: { data: [], nextCursor: null } }
              : { status: 'unavailable' }
          }
          category="GENERAL"
        />,
      );
      const nav = screen.getByRole('navigation', { name: 'News categories' });
      expect(within(nav).getByRole('link', { name: 'General' }).getAttribute('aria-current')).toBe(
        'page',
      );
      expect(within(nav).getByRole('link', { name: 'Material prices' })).toBeTruthy();
    },
  );
  it('offers a localized navigation listing every news category', () => {
    renderVi(<NewsView result={{ status: 'ok', page }} />);
    const nav = screen.getByRole('navigation', { name: 'Phân loại tin' });
    const labels = ['Tất cả tin', ...CATEGORIES.map(([, label]) => label)];
    for (const label of labels) {
      expect(within(nav).getByRole('link', { name: label })).toBeTruthy();
    }
  });

  it('points every category at ?category=<key>, keeping the household filter', () => {
    renderVi(<NewsView result={{ status: 'ok', page }} householdSlug="gom-minh-hai" />);
    const nav = screen.getByRole('navigation', { name: 'Phân loại tin' });
    for (const [key, label] of CATEGORIES) {
      const href = within(nav).getByRole('link', { name: label }).getAttribute('href') ?? '';
      const query = new URLSearchParams(href.split('?')[1] ?? '');
      expect(query.get('category')).toBe(key);
      expect(query.get('household')).toBe('gom-minh-hai');
    }
  });
});
