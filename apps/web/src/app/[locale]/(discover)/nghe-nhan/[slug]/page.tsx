import { Badge, buttonVariants, Card, cn, SealMark, VaseFigure, WaveDivider } from '@vcraft/ui';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { ImageSlot } from '@/components/image-slot';
import { ProductCard } from '@/features/catalog/product-card';
import { VillageMiniMap } from '@/features/village-map/village-mini-map';
import { Link } from '@/i18n/navigation';
import { demoParams, getArtisan, getProductsByArtisan } from '@/lib/demo/data';
import { resolveLocale } from '@/lib/locale';

export function generateStaticParams() {
  return demoParams.artisans.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/nghe-nhan/[slug]'>): Promise<Metadata> {
  const { slug } = await params;
  const a = await getArtisan(slug);
  return a ? { title: a.household, description: a.story[0] } : {};
}

/** Trang triển lãm số của hộ (FR-ART, BRAND §9): hero chân dung → bento → timeline → gallery → sản phẩm. */
export default async function ArtisanPage({ params }: PageProps<'/[locale]/nghe-nhan/[slug]'>) {
  await resolveLocale(params);
  const { slug } = await params;
  const artisan = await getArtisan(slug);
  if (!artisan) notFound();
  const [t, common, products] = await Promise.all([
    getTranslations('artisan'),
    getTranslations('common'),
    getProductsByArtisan(slug),
  ]);

  return (
    <article>
      {/* Hero toàn màn: chân dung + tên hộ Fraunces cực lớn + "Đời thứ 5". */}
      <header className="relative">
        <ImageSlot
          alt={t('portraitAlt', { name: artisan.artisanName })}
          tint={artisan.tint}
          className="h-[78svh] min-h-[28rem] rounded-none"
        />
        <div className="absolute inset-0 bg-linear-to-t from-ink/80 via-ink/20 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 mx-auto max-w-editorial px-gutter pb-12">
          <nav aria-label={t('breadcrumb')} className="mb-6 text-small text-paper/75">
            <Link href="/nghe-nhan" className="hover:text-paper">
              {t('allArtisans')}
            </Link>
            <span aria-hidden="true"> / </span>
            <span aria-current="page">{artisan.household}</span>
          </nav>
          <p className="font-mono text-small tracking-[0.2em] text-paper/80 uppercase">
            {common('generation', { n: artisan.generation })} ·{' '}
            {common('since', { year: artisan.foundedYear })}
          </p>
          <h1 className="mt-3 text-display text-paper type-wonk">{artisan.household}</h1>
          <p className="mt-4 text-paper/85">
            {artisan.artisanName} · {artisan.title} · {artisan.craft}
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/yeu-cau-bao-gia" className={buttonVariants({ size: 'lg' })}>
              {t('ctaRfq')}
            </Link>
            <Link
              href="/ban-do"
              className={cn(
                buttonVariants({ variant: 'secondary', size: 'lg' }),
                'border-paper/40 text-paper hover:bg-paper/10',
              )}
            >
              {t('ctaVisit')}
            </Link>
          </div>
        </div>
      </header>

      {/* Bento: câu chuyện, chứng nhận, xưởng, đời thứ N, năng lực. */}
      <section
        className="mx-auto grid max-w-editorial gap-5 px-gutter py-section md:grid-cols-6"
        aria-label={t('bentoLabel')}
      >
        <Card className="p-8 md:col-span-4 md:row-span-2">
          <h2 className="text-h3">{t('story')}</h2>
          {artisan.story.map((p) => (
            <p key={p.slice(0, 24)} className="mt-4 max-w-prose-vn">
              {p}
            </p>
          ))}
          <blockquote className="mt-8 border-clay border-l-2 pl-5 font-display text-h3 text-ink/85 italic">
            “{artisan.quote}”
          </blockquote>
        </Card>
        <Card className="relative flex flex-col justify-between overflow-hidden bg-glaze p-8 text-paper md:col-span-2">
          <VaseFigure
            className="absolute -right-6 -bottom-4 h-40 opacity-25"
            body="var(--color-paper)"
            band="var(--color-glaze)"
          />
          <p className="text-small text-paper/75">{t('lineage')}</p>
          <p className="font-display text-display leading-none text-paper type-wonk">
            {artisan.generation}
          </p>
          <p className="text-small text-paper/85">
            {t('lineageText', { n: artisan.generation, year: artisan.foundedYear })}
          </p>
        </Card>
        <Card className="p-8 md:col-span-2">
          <h2 className="text-h3">{t('certs')}</h2>
          <ul className="mt-4 space-y-4">
            {artisan.certifications.map((c) => (
              <li key={c.name} className="flex items-start gap-3">
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
        <Card className="overflow-hidden p-0 md:col-span-3">
          <VillageMiniMap
            label={t('mapLabel')}
            pins={[
              { id: artisan.slug, x: 50, y: 58, open: artisan.openNow, label: artisan.household },
            ]}
            highlight={artisan.slug}
            className="rounded-none shadow-none"
          />
        </Card>
        <Card className="flex flex-col gap-5 p-8 md:col-span-3">
          <div>
            <h2 className="text-h3">{t('workshop')}</h2>
            <p className="mt-2 text-ash">{artisan.address}</p>
          </div>
          <dl className="grid grid-cols-2 gap-5 text-small">
            <div>
              <dt className="text-ash">{t('hours')}</dt>
              <dd className="mt-1 flex items-center gap-2 font-medium">
                <span
                  aria-hidden="true"
                  className={cn(
                    'size-2 rounded-full',
                    artisan.openNow ? 'bg-celadon' : 'bg-ash/40',
                  )}
                />
                {artisan.hours} · {artisan.openNow ? common('openNow') : common('closed')}
              </dd>
            </div>
            <div>
              <dt className="text-ash">{t('capacity')}</dt>
              <dd className="mt-1 font-medium">
                {t('capacityValue', { count: artisan.capacityPerMonth })}
              </dd>
            </div>
            <div>
              <dt className="text-ash">{t('rating')}</dt>
              <dd className="mt-1 font-medium">
                {t('ratingValue', { rating: artisan.rating, orders: artisan.completedOrders })}
              </dd>
            </div>
          </dl>
        </Card>
      </section>

      {/* Timeline gia đình nằm ngang, kéo được (FR-ART-02). */}
      {artisan.timeline.length > 0 ? (
        <section className="pb-section" aria-labelledby="timeline-title">
          <div className="mx-auto max-w-editorial px-gutter">
            <h2 id="timeline-title">{t('timeline')}</h2>
            <p className="mt-2 text-small text-ash">{t('timelineHint')}</p>
          </div>
          <ol className="relative mt-10 flex snap-x gap-0 overflow-x-auto px-gutter pb-6">
            {artisan.timeline.map((e, i) => (
              <li key={e.year} className="relative w-72 shrink-0 snap-start pr-8">
                <span
                  aria-hidden="true"
                  className="absolute top-[0.95rem] right-0 left-0 h-px bg-linear-to-r from-clay/60 to-clay/20"
                />
                <span
                  aria-hidden="true"
                  className={cn(
                    'relative block size-8 rotate-45 rounded-[3px] border-2 border-clay bg-paper',
                    i === artisan.timeline.length - 1 && 'bg-clay',
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

      {/* Gallery xưởng kiểu masonry. */}
      {artisan.gallery.length > 0 ? (
        <section
          className="mx-auto max-w-editorial px-gutter pb-section"
          aria-labelledby="gallery-title"
        >
          <h2 id="gallery-title">{t('gallery')}</h2>
          <div className="mt-8 columns-1 gap-5 sm:columns-2 lg:columns-3">
            {artisan.gallery.map((g) => (
              <ImageSlot
                key={g.caption}
                alt={g.caption}
                caption={g.caption}
                tint={g.tint}
                ratio={g.ratio}
                className="mb-5 break-inside-avoid"
              />
            ))}
          </div>
        </section>
      ) : null}

      <WaveDivider />
      <section
        className="mx-auto max-w-editorial px-gutter pt-section"
        aria-labelledby="products-title"
      >
        <h2 id="products-title">{t('products')}</h2>
        {products.length > 0 ? (
          <ul className="mt-8 grid grid-cols-2 gap-6 md:grid-cols-4">
            {products.map((p) => (
              <li key={p.slug}>
                <ProductCard product={p} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-6 text-ash">{t('productsEmpty')}</p>
        )}
      </section>
    </article>
  );
}
