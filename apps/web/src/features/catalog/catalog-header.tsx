import { useTranslations } from 'next-intl';

/**
 * Catalog title and lead. Shared by the page and its loading skeleton so the text paints in the first
 * streamed chunk and stays put when the data arrives (the lead paragraph is the page's LCP).
 */
export function CatalogHeader() {
  const t = useTranslations('indexPages.products');
  return (
    <header className="flex max-w-prose-vn flex-col gap-3">
      <h1 className="text-h1">{t('title')}</h1>
      <p className="text-ash">{t('lead')}</p>
    </header>
  );
}
