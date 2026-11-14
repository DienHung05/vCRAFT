import { screen, within } from '@testing-library/react';
import { messages } from '@vcraft/i18n';
import { createTranslator } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';
import { SiteFooter } from '@/components/shell/site-footer';
import { renderEn, renderVi } from './render';

// `getTranslations` reads the request locale; each case fixes it and uses the real catalogs.
let locale: 'vi' | 'en' = 'vi';
vi.mock('next-intl/server', () => ({
  getTranslations: async (namespace: string) =>
    createTranslator({
      locale,
      messages: messages[locale],
      namespace: namespace as 'footer',
    }),
}));
// Resolve hrefs through the real localized pathnames, so a route missing from the table fails the test.
vi.mock('@/i18n/navigation', async () => {
  const { pathnames } = await import('@vcraft/i18n');
  return {
    Link: ({
      href,
      children,
      ...rest
    }: { href: keyof typeof pathnames; children: React.ReactNode } & Record<string, unknown>) => {
      const entry = pathnames[href];
      if (!entry) throw new Error(`Unknown route ${String(href)}`);
      const path = typeof entry === 'string' ? entry : entry[locale];
      return (
        <a href={`/${locale}${path === '/' ? '' : path}`} {...rest}>
          {children}
        </a>
      );
    },
  };
});
vi.mock('@/components/shell/locale-switcher', () => ({
  LocaleSwitcher: () => <button type="button">switch</button>,
}));

async function renderFooter(which: 'vi' | 'en') {
  locale = which;
  const ui = await SiteFooter();
  return which === 'vi' ? renderVi(ui) : renderEn(ui);
}

const href = (el: HTMLElement) => el.getAttribute('href');

describe('SiteFooter', () => {
  it('shows the contact block with a dialable phone, mail and Facebook links', async () => {
    await renderFooter('vi');
    const contact = screen.getByRole('region', { name: 'Liên hệ' });
    expect(href(within(contact).getByRole('link', { name: '0963 316 273' }))).toBe(
      'tel:+84963316273',
    );
    expect(href(within(contact).getByRole('link', { name: 'lienhe@vcraft.click' }))).toBe(
      'mailto:lienhe@vcraft.click',
    );
    const facebook = within(contact).getByRole('link', { name: /facebook\.com\/vcraft\.battrang/ });
    expect(href(facebook)).toBe('https://www.facebook.com/vcraft.battrang');
    expect(facebook.getAttribute('rel')).toContain('noopener');
    expect(within(contact).getByText('Làng gốm Bát Tràng, Gia Lâm, Hà Nội')).toBeTruthy();
  });

  it('links the real routes in a labelled footer navigation', async () => {
    await renderFooter('vi');
    const nav = screen.getByRole('navigation', { name: 'Điều hướng chân trang' });
    expect(within(nav).getAllByRole('link').map(href)).toEqual([
      '/vi/san-pham',
      '/vi/nghe-nhan',
      '/vi/ban-do',
      '/vi/tin-tuc',
      '/vi/yeu-cau-bao-gia',
      '/vi/yeu-cau-bao-gia/moi',
      '/vi/dang-ky-nghe-nhan',
    ]);
  });

  it('keeps the privacy and credits links, with the current year', async () => {
    await renderFooter('vi');
    expect(href(screen.getByRole('link', { name: 'Chính sách quyền riêng tư' }))).toBe(
      '/vi/chinh-sach-quyen-rieng-tu',
    );
    expect(href(screen.getByRole('link', { name: 'Ghi nhận ảnh' }))).toBe('/vi/ghi-nhan-anh');
    expect(screen.getByText(`© ${new Date().getFullYear()} vCraft. Giữ mọi quyền.`)).toBeTruthy();
  });

  it('uses the localized English routes on the English site', async () => {
    await renderFooter('en');
    const nav = screen.getByRole('navigation', { name: 'Footer navigation' });
    const hrefs = within(nav).getAllByRole('link').map(href);
    expect(hrefs).toContain('/en/products');
    expect(hrefs).toContain('/en/quotes/new');
    expect(hrefs).toContain('/en/register-household');
    expect(href(screen.getByRole('link', { name: 'Privacy policy' }))).toBe('/en/privacy-policy');
  });
});
