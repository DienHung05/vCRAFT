import { defaultLocale, locales, pathnames } from '@vcraft/i18n/routing';
import { defineRouting } from 'next-intl/routing';

/** Định tuyến đa ngôn ngữ (ARCHITECTURE: next-intl + pathnames bản địa hóa, SRS §5.1). */
export const routing = defineRouting({
  locales,
  defaultLocale,
  pathnames,
  // The proxy marks the cookie Secure per request (see lib/secure-cookies.ts). The client-side router
  // also rewrites it via `document.cookie` when the locale is switched, so mirror the page protocol
  // there. The key must be omitted, not `false`: next-intl appends a bare `secure;` for any boolean.
  localeCookie: {
    name: 'NEXT_LOCALE',
    sameSite: 'lax',
    ...(typeof window !== 'undefined' && window.location.protocol === 'https:' && { secure: true }),
  },
});
