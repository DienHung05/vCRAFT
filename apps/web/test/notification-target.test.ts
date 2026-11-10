import { pathnames } from '@vcraft/i18n';
import { describe, expect, it } from 'vitest';
import { type NotificationHref, notificationHref } from '@/features/notifications/target-href';

const id = '0b8f7a5e-1c2d-4e3f-a5b6-c7d8e9f0a1b2';

/** Đổi đích của next-intl thành URL theo từng ngôn ngữ, đúng như `Link` sẽ làm. */
function localized(href: NotificationHref, locale: 'vi' | 'en'): string {
  const entry = pathnames[href.pathname];
  let path: string = typeof entry === 'string' ? entry : entry[locale];
  if ('params' in href) {
    for (const [key, value] of Object.entries(href.params)) path = path.replace(`[${key}]`, value);
  }
  return `/${locale}${path}`;
}

describe('notificationHref', () => {
  it.each([
    ['BUYER_RFQ', `/vi/yeu-cau-bao-gia/${id}`, `/en/quotes/${id}`],
    ['STUDIO_CONTRIBUTION', `/vi/studio/de-xuat-tham-gia/${id}`, `/en/studio/contributions/${id}`],
    ['ADMIN_COORDINATION', `/vi/admin/dieu-phoi/${id}`, `/en/admin/coordination/${id}`],
    ['NEWS_ARTICLE', `/vi/tin-tuc/${id}`, `/en/news/${id}`],
  ] as const)('%s keeps the request id and follows the locale slug', (page, vi, en) => {
    const href = notificationHref({ page, id });
    expect(href).not.toBeNull();
    expect(localized(href as NotificationHref, 'vi')).toBe(vi);
    expect(localized(href as NotificationHref, 'en')).toBe(en);
  });

  it('sends household decisions to the application status page', () => {
    const href = notificationHref({ page: 'STUDIO_APPLICATION', id: null });
    expect(localized(href as NotificationHref, 'vi')).toBe('/vi/studio/ho-so');
    expect(localized(href as NotificationHref, 'en')).toBe('/en/studio/profile');
  });

  it('ADMIN_PAYMENTS opens the localized payments page without an id', () => {
    const href = notificationHref({ page: 'ADMIN_PAYMENTS', id: null });
    expect(href).not.toBeNull();
    expect(localized(href as NotificationHref, 'vi')).toBe('/vi/admin/thanh-toan');
    expect(localized(href as NotificationHref, 'en')).toBe('/en/admin/payments');
  });

  it('has no destination without a target, or when a request page lacks its id', () => {
    expect(notificationHref(null)).toBeNull();
    expect(notificationHref({ page: 'BUYER_RFQ', id: null })).toBeNull();
    expect(notificationHref({ page: 'ADMIN_COORDINATION', id: null })).toBeNull();
  });
});
