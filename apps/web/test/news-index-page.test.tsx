// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import NewsIndexPage from '@/app/[locale]/(discover)/tin-tuc/page';
import { fetchMaterialPrices, fetchNews } from '@/features/news/news-api';

vi.mock('@/lib/locale', () => ({ resolveLocale: vi.fn(async () => 'vi') }));
vi.mock('next-intl/server', () => ({ getTranslations: vi.fn() }));
vi.mock('@/features/news/news-view', () => ({ NewsView: () => null }));
vi.mock('@/features/news/material-price-chart', () => ({ MaterialPriceChart: () => null }));
vi.mock('@/features/news/village-news', () => ({ VillageNews: () => null }));
vi.mock('@/features/news/news-api', () => ({
  fetchNews: vi.fn(async () => ({ status: 'ok', page: { data: [], nextCursor: null } })),
  fetchMaterialPrices: vi.fn(async () => null),
}));

beforeEach(() => vi.clearAllMocks());

describe('public news URL to API wiring', () => {
  it.each([
    { input: 'MATERIAL_PRICES', expected: 'MATERIAL_PRICES' },
    { input: ['SUPPORT_POLICY', 'GENERAL'], expected: 'SUPPORT_POLICY' },
    { input: 'invalid', expected: undefined },
    { input: undefined, expected: undefined },
  ])(
    'validates category $input before passing it to the API and view',
    async ({ input, expected }) => {
      const view = await NewsIndexPage({
        params: Promise.resolve({ locale: 'vi' }),
        searchParams: Promise.resolve({ category: input, page: '2' }),
      });
      expect(fetchNews).toHaveBeenCalledWith({
        category: expected,
        householdSlug: undefined,
        page: 2,
        limit: 12,
      });
      expect(view.props.category).toBe(expected);
      expect(fetchMaterialPrices).toHaveBeenCalledOnce();
    },
  );

  it('combines category and household filters and keeps the village chart off household news', async () => {
    const view = await NewsIndexPage({
      params: Promise.resolve({ locale: 'en' }),
      searchParams: Promise.resolve({
        category: 'CRAFT_STORY',
        household: ['gom-minh-hai', 'ignored'],
        page: '3',
      }),
    });
    expect(fetchNews).toHaveBeenCalledWith({
      category: 'CRAFT_STORY',
      householdSlug: 'gom-minh-hai',
      page: 3,
      limit: 12,
    });
    expect(view.props.householdSlug).toBe('gom-minh-hai');
    expect(fetchMaterialPrices).not.toHaveBeenCalled();
  });
});
