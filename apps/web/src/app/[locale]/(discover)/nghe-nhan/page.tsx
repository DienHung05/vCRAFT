import { Badge } from '@vcraft/ui';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { ImageSlot } from '@/components/image-slot';
import { PhotoCreditsNote } from '@/components/photo-credits-note';
import { Link } from '@/i18n/navigation';
import { getArtisans } from '@/lib/demo/data';
import { resolveLocale } from '@/lib/locale';

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/nghe-nhan'>): Promise<Metadata> {
  await resolveLocale(params);
  const t = await getTranslations('indexPages.artisans');
  return { title: t('title'), description: t('lead') };
}

/** Danh sách hộ làng nghề (FR-ART): chân dung 3:4, tên hộ, nghệ nhân, đời nghề. Dữ liệu mẫu. */
export default async function ArtisansIndexPage({ params }: PageProps<'/[locale]/nghe-nhan'>) {
  await resolveLocale(params);
  const [t, common, portrait, artisans] = await Promise.all([
    getTranslations('indexPages.artisans'),
    getTranslations('indexPages'),
    getTranslations('artisan'),
    getArtisans(),
  ]);

  return (
    <div className="mx-auto max-w-editorial px-gutter pt-12 pb-section">
      <header className="flex max-w-prose-vn flex-col gap-3">
        <Badge tone="outline" className="self-start whitespace-normal">
          {common('demoNote')}
        </Badge>
        <h1 className="text-h1">{t('title')}</h1>
        <p className="text-ash">{t('lead')}</p>
        <p className="text-small text-ash">{t('count', { count: artisans.length })}</p>
      </header>
      {artisans.length > 0 ? (
        <ul className="mt-10 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {artisans.map((a) => (
            <li key={a.slug}>
              <Link
                href={{ pathname: '/nghe-nhan/[slug]', params: { slug: a.slug } }}
                className="group block"
              >
                <ImageSlot
                  alt={portrait('portraitAlt', { name: a.artisanName })}
                  tint={a.tint}
                  ratio="3/4"
                  photo={a.portrait}
                  sizes="(min-width: 1024px) 22vw, (min-width: 640px) 45vw, 100vw"
                  className="transition-transform duration-(--duration-slow) ease-clay group-hover:-translate-y-1 motion-reduce:transition-none motion-reduce:group-hover:translate-y-0"
                />
                <h2 className="mt-4 text-h3 transition-colors group-hover:text-clay">
                  {a.household}
                </h2>
                <p className="text-small text-ash">
                  {t('meta', { artisan: a.artisanName, craft: a.craft })}
                </p>
                <p className="mt-1 text-small text-ash">
                  {t('since', { n: a.generation, year: a.foundedYear })}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-10 text-ash">{t('empty')}</p>
      )}
      <PhotoCreditsNote />
    </div>
  );
}
