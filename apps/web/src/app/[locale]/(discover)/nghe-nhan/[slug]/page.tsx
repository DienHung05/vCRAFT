import { Badge, buttonVariants, Card, cn, SealMark, VaseFigure, WaveDivider } from '@vcraft/ui';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { Breadcrumbs } from '@/components/breadcrumbs';
import { DataUnavailable } from '@/components/data-unavailable';
import { ImageSlot } from '@/components/image-slot';
import { PhotoCredit } from '@/components/photo-credit';
import { EmptyState } from '@/components/states/empty-state';
import { fetchHousehold } from '@/features/catalog/exhibition-api';
import { ProductCard } from '@/features/catalog/product-card';
import {
  altFor,
  householdCover,
  photoFromUrl,
  slotPhoto,
  tintOf,
  toProductCardView,
  toVisitWorkshops,
} from '@/features/catalog/view-models';
import { MakerCredits } from '@/features/exhibition/maker-credits';
import { VisitSection } from '@/features/exhibition/visit-section';
import { Link } from '@/i18n/navigation';
import { resolveLocale } from '@/lib/locale';

// Hồ sơ lấy từ API lúc có yêu cầu (không dựng tĩnh lúc build, khi API có thể chưa chạy).
export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/nghe-nhan/[slug]'>): Promise<Metadata> {
  const { slug } = await params;
  const result = await fetchHousehold(slug);
  return result.status === 'ok'
    ? { title: result.data.name, description: result.data.history.slice(0, 160) }
    : {};
}

/**
 * Trang triển lãm số của hộ — biến thể A "đọc liền một mạch" (vCRAFT-9hg.6): lịch sử hộ → người làm →
 * món đồ → bằng chứng (nhật ký) → ghé thăm (phòng trưng bày tách khỏi xưởng, bản đồ kèm danh sách)
 * → đặt hàng số lượng.
 */
export default async function ArtisanPage({ params }: PageProps<'/[locale]/nghe-nhan/[slug]'>) {
  const locale = await resolveLocale(params);
  const { slug } = await params;
  const [t, common, nav, categories, ex, preset, result] = await Promise.all([
    getTranslations('artisan'),
    getTranslations('common'),
    getTranslations('nav'),
    getTranslations('catalog.categories'),
    getTranslations('exhibition'),
    getTranslations('presetFigure'),
    fetchHousehold(slug),
  ]);
  if (result.status === 'not-found') notFound();
  if (result.status === 'unavailable') return <DataUnavailable />;

  const household = result.data;
  const representative = household.artisans[0];
  // What the cover really shows (its own description); without a photo the frame is only an illustration.
  const householdPhoto = householdCover(locale, household);
  const coverAlt = householdPhoto.alt || preset('household');
  const cover = householdPhoto.view && { ...householdPhoto.view, alt: coverAlt };
  const portrait = household.portrait;
  const portraitAlt = portrait ? altFor(locale, portrait.alt, portrait.altEn) : '';
  const portraitPhoto = portrait
    ? photoFromUrl(portrait.url, portraitAlt, portrait.variants)
    : undefined;
  const featured = household.products[0];
  const story = household.history.split(/\n{2,}/).filter(Boolean);
  const gallery = household.gallery.flatMap((item) => (item.url ? [item] : []));
  const capacities = Object.entries(household.capacityByCategory) as [
    keyof typeof household.capacityByCategory,
    number,
  ][];

  return (
    <article>
      {/* Hero toàn màn: ảnh xưởng + tên hộ Fraunces cực lớn. */}
      <header className="relative">
        <ImageSlot
          alt={coverAlt}
          tint={tintOf(household.slug)}
          {...slotPhoto(cover)}
          priority
          sizes="100vw"
          className="h-[78svh] min-h-[28rem] rounded-none"
        />
        <div className="absolute inset-0 bg-linear-to-t from-ink/85 via-ink/40 to-ink/10" />
        <div className="absolute inset-x-0 bottom-0 mx-auto max-w-editorial px-gutter pb-12">
          <Breadcrumbs
            className="mb-6 text-paper/75 [&_a:hover]:text-paper [&_span[aria-current]]:text-paper"
            items={[
              { label: common('home'), href: '/' },
              { label: t('allArtisans'), href: '/nghe-nhan' },
              { label: household.name },
            ]}
          />
          {household.generations && household.foundedYear ? (
            <p className="font-mono text-small tracking-[0.2em] text-paper/80 uppercase">
              {common('generation', { n: household.generations })} ·{' '}
              {common('since', { year: household.foundedYear })}
            </p>
          ) : null}
          <h1 className="mt-3 text-display text-paper type-wonk">{household.name}</h1>
          <p className="mt-4 text-paper/85">
            {[representative?.name, household.craft, household.village].filter(Boolean).join(' · ')}
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/yeu-cau-bao-gia" className={buttonVariants({ size: 'lg' })}>
              {t('ctaRfq')}
            </Link>
            <a
              href="#workshop"
              className={cn(
                buttonVariants({ variant: 'secondary', size: 'lg' }),
                'border-paper/40 text-paper hover:bg-paper/10',
              )}
            >
              {t('ctaVisit')}
            </a>
          </div>
        </div>
      </header>
      {cover ? (
        <div className="mx-auto max-w-editorial px-gutter">
          <PhotoCredit
            id={cover.photo?.id}
            credit={householdPhoto.credit}
            className="mt-2 text-right text-[0.75rem] text-ash"
          />
        </div>
      ) : null}

      {/* Bento: câu chuyện, đời thứ N, chứng nhận. */}
      <section
        className="mx-auto grid max-w-editorial gap-5 px-gutter py-section md:grid-cols-6"
        aria-label={t('bentoLabel')}
      >
        <Card className="p-8 md:col-span-4 md:row-span-2">
          {portrait ? (
            <figure className="mb-6 sm:float-right sm:mb-2 sm:ml-6 sm:w-44">
              <ImageSlot
                alt={portraitAlt}
                tint={tintOf(portrait.url)}
                ratio="4/5"
                {...slotPhoto(portraitPhoto)}
                // Below 640px the card is the page width minus gutters and padding; 80vw keeps 1.75x phones on the 640w file.
                sizes="(min-width: 640px) 11rem, 80vw"
              />
              <PhotoCredit id={portraitPhoto?.photo?.id} credit={portrait.credit} />
            </figure>
          ) : null}
          <h2 className="text-h3">{t('story')}</h2>
          {story.map((paragraph) => (
            <p key={paragraph.slice(0, 24)} className="mt-4 max-w-prose-vn">
              {paragraph}
            </p>
          ))}
        </Card>
        {household.generations && household.foundedYear ? (
          <Card className="relative flex flex-col justify-between overflow-hidden bg-glaze p-8 text-paper md:col-span-2">
            <VaseFigure
              className="absolute -right-6 -bottom-4 h-40 opacity-25"
              body="var(--color-paper)"
              band="var(--color-glaze)"
            />
            <p className="text-small text-paper/75">{t('lineage')}</p>
            <p className="font-display text-display leading-none text-paper type-wonk">
              {household.generations}
            </p>
            <p className="text-small text-paper/85">
              {t('lineageText', { n: household.generations, year: household.foundedYear })}
            </p>
          </Card>
        ) : null}
        {household.certifications.length > 0 ? (
          <Card className="p-8 md:col-span-2">
            <h2 className="text-h3">{t('certs')}</h2>
            <ul className="mt-4 space-y-4">
              {household.certifications.map((c) => (
                <li key={`${c.name}-${c.year}`} className="flex items-start gap-3">
                  {c.verified ? (
                    <SealMark size={24} bleed={false} />
                  ) : (
                    <span className="size-6 shrink-0 rounded-sm border border-ink/25 border-dashed" />
                  )}
                  <div>
                    <p className="font-medium">{c.name}</p>
                    <p className="text-small text-ash">
                      {c.issuer} · {c.year}
                    </p>
                    <Badge tone={c.verified ? 'lacquer' : 'outline'} className="mt-1">
                      {c.verified ? common('verified') : common('unverified')}
                    </Badge>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        ) : null}
      </section>

      {/* Timeline gia đình nằm ngang, kéo được (FR-ART-02). */}
      {household.timeline.length > 0 ? (
        <section className="pb-section" aria-labelledby="timeline-title">
          <div className="mx-auto max-w-editorial px-gutter">
            <h2 id="timeline-title">{t('timeline')}</h2>
            <p className="mt-2 text-small text-ash">{t('timelineHint')}</p>
          </div>
          <ol
            aria-labelledby="timeline-title"
            // biome-ignore lint/a11y/noNoninteractiveTabindex: vùng cuộn ngang phải nhận focus để cuộn bằng phím mũi tên (WCAG 2.1.1, axe scrollable-region-focusable).
            tabIndex={0}
            className="relative mt-10 flex snap-x gap-0 overflow-x-auto px-gutter pb-6 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-glaze"
          >
            {household.timeline.map((e, i) => (
              <li key={`${e.year}-${e.title}`} className="relative w-72 shrink-0 snap-start pr-8">
                <span
                  aria-hidden="true"
                  className="absolute top-[0.95rem] right-0 left-0 h-px bg-linear-to-r from-clay/60 to-clay/20"
                />
                <span
                  aria-hidden="true"
                  className={cn(
                    'relative block size-8 rotate-45 rounded-[3px] border-2 border-clay bg-paper',
                    i === household.timeline.length - 1 && 'bg-clay',
                  )}
                />
                <p className="mt-5 font-display text-h2 text-clay type-soft">{e.year}</p>
                <h3 className="mt-1 font-sans text-body font-semibold text-ink">{e.title}</h3>
                <p className="mt-1 text-small text-ash">{e.text}</p>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      {/* Thư viện ảnh xưởng kiểu masonry (FR-ART-04). */}
      {gallery.length > 0 ? (
        <section
          className="cv-auto mx-auto max-w-editorial px-gutter pb-section"
          aria-labelledby="gallery-title"
        >
          <h2 id="gallery-title">{t('gallery')}</h2>
          <div className="mt-8 columns-1 gap-5 sm:columns-2 lg:columns-3">
            {gallery.map((item) => {
              const itemAlt = altFor(locale, item.alt, item.altEn);
              const image = photoFromUrl(item.url, itemAlt, item.variants);
              return (
                <figure key={item.url} className="mb-5 break-inside-avoid">
                  <ImageSlot
                    alt={itemAlt}
                    tint={tintOf(item.alt)}
                    ratio="3/2"
                    {...(item.caption ? { caption: item.caption } : {})}
                    {...slotPhoto(image)}
                    // 88vw (not 100vw): the single column is ~92vw wide, and this keeps 1.75x phones on the 640w file.
                    sizes="(min-width: 1024px) 28vw, (min-width: 640px) 45vw, 88vw"
                  />
                  <PhotoCredit id={image?.photo?.id} credit={item.credit} />
                </figure>
              );
            })}
          </div>
        </section>
      ) : null}

      <MakerCredits
        className="mx-auto max-w-editorial px-gutter pb-section"
        household={household.name}
        makers={household.artisans.map((a) => ({ name: a.name, detail: a.craftRole ?? '' }))}
      />

      <WaveDivider />
      <section
        className="mx-auto max-w-editorial px-gutter pt-section"
        aria-labelledby="products-title"
      >
        <h2 id="products-title">{t('products')}</h2>
        {household.products.length > 0 ? (
          <ul className="mt-8 grid grid-cols-2 gap-6 md:grid-cols-4">
            {household.products.map((p) => (
              <li key={p.slug}>
                <ProductCard product={toProductCardView({ ...p, household }, locale)} />
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            className="mt-6"
            illustration="vase"
            headingLevel="h3"
            title={t('productsEmpty')}
            action={
              <Link href="/san-pham" className={buttonVariants({ variant: 'secondary' })}>
                {nav('products')}
              </Link>
            }
          />
        )}
      </section>

      {/* Bằng chứng: nhật ký sản xuất của món đồ tiêu biểu, đọc ở trang truy xuất. */}
      {featured ? (
        <section
          className="mx-auto max-w-editorial px-gutter pt-section"
          aria-labelledby="evidence-title"
        >
          <Card className="flex flex-col items-start gap-4 p-8 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-5">
              <SealMark size={56} bleed={false} />
              <div>
                <h2 id="evidence-title" className="text-h3">
                  {ex('evidenceTitle')}
                </h2>
                <p className="mt-1 max-w-prose-vn text-small text-ash">{ex('evidenceText')}</p>
              </div>
            </div>
            <Link
              href={{ pathname: '/truy-xuat/[code]', params: { code: featured.traceCode } }}
              className={buttonVariants({ variant: 'secondary' })}
            >
              {ex('evidenceCta', { product: featured.name })}
            </Link>
          </Card>
        </section>
      ) : null}

      <VisitSection
        className="mx-auto max-w-editorial px-gutter pt-section"
        household={household.name}
        workshops={toVisitWorkshops(household.workshops)}
      />

      <section
        className="mx-auto max-w-editorial px-gutter py-section"
        aria-labelledby="wholesale-title"
      >
        <div className="rounded-card bg-clay p-8 text-paper md:p-12">
          <h2 id="wholesale-title" className="text-paper">
            {ex('wholesaleTitle')}
          </h2>
          <p className="mt-3 max-w-prose-vn text-paper">{ex('wholesaleText')}</p>
          {capacities.length > 0 ? (
            <p className="mt-2 text-small text-paper">
              {t('capacity')}:{' '}
              {capacities
                .map(
                  ([category, count]) => `${categories(category)} ${t('capacityValue', { count })}`,
                )
                .join(' · ')}
            </p>
          ) : null}
          <Link
            href="/yeu-cau-bao-gia"
            className={cn(
              buttonVariants({ variant: 'secondary', size: 'lg' }),
              'mt-6 border-paper/40 text-paper hover:bg-paper/10',
            )}
          >
            {t('ctaRfq')}
          </Link>
        </div>
      </section>
    </article>
  );
}
