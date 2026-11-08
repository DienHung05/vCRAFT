import { render, screen, within } from '@testing-library/react';
import { messages } from '@vcraft/i18n';
import { createTranslator } from 'next-intl';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  type HeaderNavItem,
  HeaderNavLinks,
  isNavActive,
} from '@/components/shell/header-nav-links';

// next-intl's `usePathname` returns the internal key without locale prefix, for both locales.
let pathname = '/';
vi.mock('@/i18n/navigation', () => ({
  usePathname: () => pathname,
  Link: ({
    href,
    children,
    ...rest
  }: { href: string; children: React.ReactNode } & Record<string, unknown>) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const HREFS: HeaderNavItem['href'][] = [
  '/san-pham',
  '/nghe-nhan',
  '/ban-do',
  '/tin-tuc',
  '/yeu-cau-bao-gia',
];
const KEYS = ['products', 'artisans', 'map', 'news', 'quotes'] as const;

function itemsFor(locale: 'vi' | 'en'): HeaderNavItem[] {
  const t = createTranslator({ locale, messages: messages[locale], namespace: 'nav' });
  return HREFS.map((href, i) => ({ href, label: t(KEYS[i] as 'products') }));
}

function activeLinks(): string[] {
  return screen
    .getAllByRole('link')
    .filter((a) => a.getAttribute('aria-current') === 'page')
    .map((a) => a.getAttribute('href') ?? '');
}

afterEach(() => {
  pathname = '/';
});

describe('isNavActive', () => {
  it('matches the exact path and pages below it, not look-alike prefixes', () => {
    expect(isNavActive('/san-pham', '/san-pham')).toBe(true);
    expect(isNavActive('/san-pham/[slug]', '/san-pham')).toBe(true);
    expect(isNavActive('/san-pham-moi', '/san-pham')).toBe(false);
    expect(isNavActive('/', '/san-pham')).toBe(false);
  });
});

describe.each(['vi', 'en'] as const)('HeaderNavLinks (%s)', (locale) => {
  const sections: [string, string, string][] = [
    ['/san-pham', '/san-pham/[slug]', '/san-pham'],
    ['/nghe-nhan', '/nghe-nhan/[slug]', '/nghe-nhan'],
    ['/ban-do', '/ban-do', '/ban-do'],
    ['/tin-tuc', '/tin-tuc/[slug]', '/tin-tuc'],
    ['/yeu-cau-bao-gia', '/yeu-cau-bao-gia/[code]', '/yeu-cau-bao-gia'],
  ];

  it.each(sections)('marks only %s on its index and detail page', (index, detail, href) => {
    for (const current of [index, detail]) {
      pathname = current;
      const { unmount } = render(<HeaderNavLinks items={itemsFor(locale)} brush />);
      expect(activeLinks()).toEqual([href]);
      unmount();
    }
  });

  it('shows the translated label on the active link', () => {
    pathname = '/ban-do';
    render(<HeaderNavLinks items={itemsFor(locale)} brush />);
    const label = itemsFor(locale)[2]?.label ?? '';
    expect(within(screen.getByRole('link', { current: 'page' })).getByText(label)).toBeTruthy();
  });

  it('marks nothing on the home page', () => {
    pathname = '/';
    render(<HeaderNavLinks items={itemsFor(locale)} brush />);
    expect(activeLinks()).toEqual([]);
  });
});

describe('HeaderNavLinks variants', () => {
  it('draws the brush in the bar only, and underlines the active item in the menu', () => {
    pathname = '/tin-tuc/[slug]';
    const { unmount } = render(<HeaderNavLinks items={itemsFor('en')} brush />);
    expect(screen.getByTestId('tab-brush')).toBeTruthy();
    expect(screen.getByRole('link', { current: 'page' }).className).not.toContain('underline');
    unmount();

    render(<HeaderNavLinks items={itemsFor('en')} />);
    expect(screen.queryByTestId('tab-brush')).toBeNull();
    expect(screen.getByRole('link', { current: 'page' }).className).toContain('underline');
  });
});
