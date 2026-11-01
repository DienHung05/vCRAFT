import { screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Breadcrumbs } from '@/components/breadcrumbs';
import { buildBreadcrumbTrail } from '@/lib/breadcrumbs';
import { renderEn, renderVi } from './render';

vi.mock('@/i18n/navigation', () => ({
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

describe('buildBreadcrumbTrail', () => {
  it('marks only the last crumb as current and drops its link', () => {
    const trail = buildBreadcrumbTrail([
      { label: 'Home', href: '/' },
      { label: 'Products', href: '/san-pham' },
      { label: 'Artisans', href: '/nghe-nhan' },
    ]);
    expect(trail.map((crumb) => crumb.current)).toEqual([false, false, true]);
    expect(trail[0]?.href).toBe('/');
    expect(trail[2]?.href).toBeUndefined();
  });

  it('skips falsy and empty entries so callers can add crumbs conditionally', () => {
    const trail = buildBreadcrumbTrail([
      { label: 'Home', href: '/' },
      false,
      null,
      undefined,
      { label: '  ' },
      { label: 'Page' },
    ]);
    expect(trail.map((crumb) => crumb.label)).toEqual(['Home', 'Page']);
  });

  it('returns nothing for a trail shorter than two crumbs', () => {
    expect(buildBreadcrumbTrail([])).toEqual([]);
    expect(buildBreadcrumbTrail([{ label: 'Only' }])).toEqual([]);
  });
});

describe('Breadcrumbs', () => {
  const items = [
    { label: 'Trang chủ', href: '/' },
    { label: 'Sản phẩm', href: '/san-pham' },
    { label: 'Bình hút lộc' },
  ] as const;

  it('renders a labelled nav with an ordered list and aria-current on the last crumb', () => {
    renderVi(<Breadcrumbs items={items} />);
    const nav = screen.getByRole('navigation', { name: 'Đường dẫn trang' });
    const crumbs = within(nav).getAllByRole('listitem');
    expect(crumbs).toHaveLength(3);
    expect(
      within(nav)
        .getAllByRole('link')
        .map((link) => link.textContent),
    ).toEqual(['Trang chủ', 'Sản phẩm']);
    const current = nav.querySelector('[aria-current="page"]');
    expect(current?.textContent).toBe('Bình hút lộc');
    expect(current?.closest('a')).toBeNull();
  });

  it('uses the English label on the English site', () => {
    renderEn(<Breadcrumbs items={items} />);
    expect(screen.getByRole('navigation', { name: 'Breadcrumb' })).toBeTruthy();
  });

  it('renders nothing for a single crumb', () => {
    renderVi(<Breadcrumbs items={[{ label: 'Only' }]} />);
    expect(screen.queryByRole('navigation')).toBeNull();
  });
});
