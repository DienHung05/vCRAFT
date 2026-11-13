import { useTranslations } from 'next-intl';

/**
 * Map page title and lead. Shared by the page and its loading skeleton so the text is in the first
 * streamed chunk (the lead paragraph is the page's LCP) and does not move when the pins arrive (GH#481).
 */
export function MapHeader() {
  const t = useTranslations('villageMap');
  return (
    <header className="flex max-w-prose-vn flex-col gap-3">
      <h1 className="text-h1">{t('title')}</h1>
      <p className="text-ash">{t('lead')}</p>
    </header>
  );
}
