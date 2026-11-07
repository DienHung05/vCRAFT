import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { pageHref, UrlPagination } from '@/components/url-pagination';
import { parsePageParam } from '@/lib/page-param';
import { renderEn, renderVi } from './render';

const push = vi.fn();
vi.mock('next/navigation', () => ({
  usePathname: () => '/vi/tin-tuc',
  useSearchParams: () => new URLSearchParams('household=gom-a&page=2'),
  useRouter: () => ({ push }),
}));

/** GH#202: numbered pages on the household and news lists, as in the catalog. */
describe('parsePageParam', () => {
  it('accepts whole pages from 1 to 10,000 and falls back to page 1', () => {
    expect(parsePageParam('3')).toBe(3);
    expect(parsePageParam(['4', '5'])).toBe(4);
    for (const bad of [undefined, '', '0', '-1', 'abc', '2.5', '10001', '999999']) {
      expect(parsePageParam(bad), String(bad)).toBe(1);
    }
  });
});

describe('pageHref', () => {
  it('sets the page and keeps the other parameters; page 1 drops it', () => {
    expect(pageHref('/vi/tin-tuc', 'household=gom-a&page=2', 3)).toBe(
      '/vi/tin-tuc?household=gom-a&page=3',
    );
    expect(pageHref('/vi/tin-tuc', 'household=gom-a&page=2', 1)).toBe(
      '/vi/tin-tuc?household=gom-a',
    );
    expect(pageHref('/vi/nghe-nhan', 'page=2', 1)).toBe('/vi/nghe-nhan');
  });
});

describe('<UrlPagination>', () => {
  it('links every page to its URL and names the list it pages', () => {
    renderVi(<UrlPagination kind="news" page={2} totalPages={3} total={30} pageSize={12} />);
    expect(screen.getByRole('navigation', { name: 'Phân trang tin tức' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Trang 3' }).getAttribute('href')).toBe(
      '/vi/tin-tuc?household=gom-a&page=3',
    );
    expect(screen.getByText('Hiển thị 13–24 trong 30 tin')).toBeTruthy();
    fireEvent.click(screen.getByRole('link', { name: 'Trang 1' }));
    expect(push).toHaveBeenCalledWith('/vi/tin-tuc?household=gom-a');
  });

  it('is hidden with a single page', () => {
    renderEn(<UrlPagination kind="households" page={1} totalPages={1} total={5} pageSize={12} />);
    expect(screen.queryByRole('navigation')).toBeNull();
  });
});
