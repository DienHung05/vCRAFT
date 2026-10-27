import { defaultLocale, locales, pathnames } from '@vcraft/i18n';
import { defineRouting } from 'next-intl/routing';

/** Định tuyến đa ngôn ngữ (ARCHITECTURE: next-intl + pathnames bản địa hóa, SRS §5.1). */
export const routing = defineRouting({
  locales,
  defaultLocale,
  pathnames,
});
