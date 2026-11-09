import { buttonVariants, cn } from '@vcraft/ui';
import { getTranslations } from 'next-intl/server';
import { DataUnavailable } from '@/components/data-unavailable';
import { ImageSlot } from '@/components/image-slot';
import { EmptyState } from '@/components/states/empty-state';
import { InkReveal } from '@/experience/motion/ink-reveal';
import { fetchHouseholds } from '@/features/catalog/exhibition-api';
import { altFor, photoFromUrl, slotPhoto, tintOf } from '@/features/catalog/view-models';
import { Link } from '@/i18n/navigation';

/** Featured households, streamed under the static heading so the hero and the story never wait. */
export async function FeaturedArtisans({ locale }: { locale: string }) {
  const [t, preset, householdsResult] = await Promise.all([
    getTranslations('home'),
    getTranslations('presetFigure'),
    fetchHouseholds(),
  ]);
  const households = householdsResult.status === 'ok' ? householdsResult.data.data : [];
  const featured = households.filter((h) => h.coverUrl).slice(0, 3);

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
    <ul className="mt-10 grid gap-8 md:grid-cols-3">
      {featured.map((h, i) => {
        const coverAlt = altFor(locale, h.coverAlt ?? '', h.coverAltEn) || preset('household');
        return (
          <li key={h.slug} className={cn(i === 1 && 'md:mt-16')}>
            <Link
              href={{ pathname: '/nghe-nhan/[slug]', params: { slug: h.slug } }}
              className="group block"
            >
              <InkReveal>
                <ImageSlot
                  alt={coverAlt}
                  tint={tintOf(h.slug)}
                  ratio="3/4"
                  {...slotPhoto(photoFromUrl(h.coverUrl, coverAlt, h.coverVariants))}
                  sizes="(min-width: 768px) 30vw, 100vw"
                  className="motion-safe:transition-transform motion-safe:duration-(--duration-slow) motion-safe:ease-clay motion-safe:group-hover:-translate-y-1"
                />
              </InkReveal>
              <h3 className="mt-4 transition-colors group-hover:text-clay">{h.name}</h3>
              <p className="text-small text-ash">
                {[h.representative, h.craft].filter(Boolean).join(' · ')}
              </p>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
