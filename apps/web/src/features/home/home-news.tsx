import { buttonVariants } from '@vcraft/ui';
import { getFormatter, getTranslations } from 'next-intl/server';
import { DataUnavailable } from '@/components/data-unavailable';
import { ImageSlot } from '@/components/image-slot';
import { EmptyState } from '@/components/states/empty-state';
import { altFor, photoFromUrl, slotPhoto, tintOf } from '@/features/catalog/view-models';
import { fetchNews } from '@/features/news/news-api';
import { NewsSourceLine } from '@/features/news/news-source-line';
import { Link } from '@/i18n/navigation';

/** The three newest stories, streamed under the static heading; photo and title both open the story. */
export async function HomeNews({ locale }: { locale: string }) {
  const [t, format, newsResult] = await Promise.all([
    getTranslations('home'),
    getFormatter(),
    fetchNews({ limit: 3 }),
  ]);

  if (newsResult.status !== 'ok') {
    return <DataUnavailable className="mt-8 flex flex-col items-start gap-3" />;
  }
  if (newsResult.page.data.length === 0) {
    return (
      <EmptyState
        className="mt-6"
        illustration="scroll"
        headingLevel="h3"
        title={t('news.empty')}
        action={
          <Link href="/tin-tuc" className={buttonVariants({ variant: 'secondary' })}>
            {t('news.all')}
          </Link>
        }
      />
    );
  }
  return (
    <ul className="mt-8 grid gap-6 md:grid-cols-3">
      {newsResult.page.data.map((n) => {
        const alt = altFor(locale, n.cover?.alt || n.title, n.cover?.altEn);
        return (
          <li key={n.slug} className="flex flex-col gap-3">
            {n.cover ? (
              <Link
                href={{ pathname: '/tin-tuc/[slug]', params: { slug: n.slug } }}
                className="block rounded-card motion-safe:transition-transform motion-safe:duration-(--duration-slow) motion-safe:ease-clay motion-safe:hover:-translate-y-1"
              >
                <ImageSlot
                  alt={alt}
                  tint={tintOf(n.slug)}
                  ratio="3/2"
                  {...slotPhoto(photoFromUrl(n.cover.url, alt, n.cover.variants))}
                />
              </Link>
            ) : null}
            <time dateTime={n.publishedAt} className="text-small text-ash">
              {format.dateTime(new Date(n.publishedAt), 'long')}
            </time>
            <h3 className="text-[1.25rem] leading-snug">
              <Link
                href={{ pathname: '/tin-tuc/[slug]', params: { slug: n.slug } }}
                className="transition-colors hover:text-clay"
              >
                {n.title}
              </Link>
            </h3>
            <NewsSourceLine item={n} />
          </li>
        );
      })}
    </ul>
  );
}
