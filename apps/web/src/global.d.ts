import type { Locale, Messages } from '@vcraft/i18n';
import type { formats } from './i18n/formats';

declare module 'next-intl' {
  interface AppConfig {
    Locale: Locale;
    Messages: Messages;
    Formats: typeof formats;
  }
}
