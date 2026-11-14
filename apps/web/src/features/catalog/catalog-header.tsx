import { useTranslations } from 'next-intl';

/** Catalog title and lead, sent with the product grid in the initial document (GH#529). */
export function CatalogHeader() {
  const t = useTranslations('indexPages.products');
  return (
    <header className="flex max-w-prose-vn flex-col gap-3">
      <h1 className="text-h1">{t('title')}</h1>
      <p className="text-ash">{t('lead')}</p>
    </header>
  );
}
