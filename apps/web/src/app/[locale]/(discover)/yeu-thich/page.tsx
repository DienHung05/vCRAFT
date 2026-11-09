import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { FavouritesList } from '@/features/favourites/favourites-list';
import { resolveLocale } from '@/lib/locale';

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/yeu-thich'>): Promise<Metadata> {
  await resolveLocale(params);
  const t = await getTranslations('favourites');
  // A personal list: nothing here for a search engine to index.
  return { title: t('title'), robots: { index: false } };
}

/** The products a visitor saved with the heart (FR-CAT-07); the list is read in the browser. */
export default async function FavouritesPage({ params }: PageProps<'/[locale]/yeu-thich'>) {
  await resolveLocale(params);
  const t = await getTranslations('favourites');
  return (
    <div className="mx-auto max-w-editorial px-gutter pt-12 pb-section">
      <header className="mb-10 flex max-w-prose-vn flex-col gap-3">
        <h1 className="text-h1">{t('title')}</h1>
        <p className="text-ash">{t('lead')}</p>
      </header>
      <FavouritesList />
    </div>
  );
}
