import { buttonVariants } from '@vcraft/ui';
import { getTranslations } from 'next-intl/server';
import { DataUnavailable } from '@/components/data-unavailable';
import { ImageSlot } from '@/components/image-slot';
import { EmptyState } from '@/components/states/empty-state';
import { InkReveal } from '@/experience/motion/ink-reveal';
import { craftLabel } from '@/features/catalog/craft-label';
import { fetchHouseholds } from '@/features/catalog/exhibition-api';
import { altFor, photoFromUrl, slotPhoto, tintOf } from '@/features/catalog/view-models';
import { Link } from '@/i18n/navigation';

/** Featured households, streamed under the static heading so the hero and the story never wait. */
export async function FeaturedArtisans({ locale }: { locale: string }) {
  const [t, preset, crafts, householdsResult] = await Promise.all([
    getTranslations('home'),
    getTranslations('presetFigure'),
    getTranslations('catalog.craftCategories'),
    fetchHouseholds(),
  ]);
  const households = householdsResult.status === 'ok' ? householdsResult.data.data : [];
  // Four households read as one row of the village (Hộ is the producing unit), not a lone hero card.
  const featured = households.filter((h) => h.coverUrl).slice(0, 4);

  if (householdsResult.status !== 'ok') {
    return <DataUnavailable className="mt-10 flex flex-col items-start gap-3" />;
  }
  if (featured.length === 0) {
    return (
      <EmptyState
        className="mt-6"
        illustration="vase"
        headingLevel="h3"
        title={t('artisans.empty')}
        action={
          <Link href="/san-pham" className={buttonVariants({ variant: 'secondary' })}>
            {t('hero.ctaExplore')}
          </Link>
        }
      />
    );
  }
  return (
    <ul className="mt-10 grid grid-cols-2 gap-x-5 gap-y-8 md:grid-cols-3 md:gap-x-6 lg:grid-cols-4">
      {featured.map((h) => {
        const coverAlt = altFor(locale, h.coverAlt ?? '', h.coverAltEn) || preset('household');
        return (
          <li key={h.slug}>
            <Link
              href={{ pathname: '/nghe-nhan/[slug]', params: { slug: h.slug } }}
              className="group block"
            >
              <InkReveal>
                <ImageSlot
                  alt={coverAlt}
                  tint={tintOf(h.slug)}
                  ratio="4/3"
                  {...slotPhoto(photoFromUrl(h.coverUrl, coverAlt, h.coverVariants))}
                  sizes="(min-width: 1024px) 22vw, (min-width: 768px) 30vw, 45vw"
                  className="motion-safe:transition-transform motion-safe:duration-(--duration-slow) motion-safe:ease-clay motion-safe:group-hover:-translate-y-1"
                />
              </InkReveal>
              <h3 className="mt-3 text-[1.25rem] leading-snug transition-colors group-hover:text-clay sm:text-h3">
                {h.name}
              </h3>
              <p className="text-small text-ash">
                {[h.representative, craftLabel(locale, h, (category) => crafts(category))]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
