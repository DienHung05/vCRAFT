import { Badge, buttonVariants, ProductFigure, SealMark } from '@vcraft/ui';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getFormatter, getTranslations } from 'next-intl/server';
import { ViewTransition } from 'react';
import { Breadcrumbs } from '@/components/breadcrumbs';
import { DataUnavailable } from '@/components/data-unavailable';
import { ImageSlot } from '@/components/image-slot';
import { UsdRateNote, UsdReference } from '@/components/usd-reference';
import { fetchProduct, fetchProducts, fetchSlugRedirect } from '@/features/catalog/exhibition-api';
import { JourneyCard } from '@/features/catalog/journey-card';
import { presetKindOf } from '@/features/catalog/preset-figure';
import { ProductCard, productImageTransition } from '@/features/catalog/product-card';
import { GalleryTrigger, ProductGallery } from '@/features/catalog/product-gallery';
import { ProductQr } from '@/features/catalog/product-qr';
import {
  altFor,
  type GallerySlide,
  gallerySlide,
  photoFromUrl,
  slotPhoto,
  tintOf,
  toLogEntries,
  toProductCardView,
} from '@/features/catalog/view-models';
import { Link, permanentRedirect } from '@/i18n/navigation';
import { frameRatioOf } from '@/lib/images';
import { resolveLocale } from '@/lib/locale';
import { jsonLd, metaDescription, pageMetadata } from '@/lib/seo/page-metadata';
import { localizedPath } from '@/lib/seo/sitemap-entries';
import { siteOrigin, traceShortUrl } from '@/lib/site';

// Dữ liệu lấy từ API lúc có yêu cầu (không dựng tĩnh lúc build, khi API có thể chưa chạy).
export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/san-pham/[slug]'>): Promise<Metadata> {
  const locale = await resolveLocale(params);
  const { slug } = await params;
  const result = await fetchProduct(slug);
  if (result.status !== 'ok') return {};
  const { product } = result.data;
  return pageMetadata({
    locale,
    href: { pathname: '/san-pham/[slug]', params: { slug: product.slug } },
    title: product.name,
    description: metaDescription(product.description || product.name),
  });
}

/** Chi tiết sản phẩm (FR-PRD, BRAND §9): ảnh 4:5 sticky bên trái, thông tin bên phải, nhật ký rút gọn. */
export default async function ProductPage({ params }: PageProps<'/[locale]/san-pham/[slug]'>) {
  const locale = await resolveLocale(params);
  const { slug } = await params;
  const result = await fetchProduct(slug);
  if (result.status === 'not-found') {
    // A product renamed since the link was shared: send the visitor to its current URL (PLAN E5).
    const moved = await fetchSlugRedirect('products', slug);
    if (moved.status === 'ok') {
      permanentRedirect({
        href: { pathname: '/san-pham/[slug]', params: { slug: moved.data.slug } },
        locale,
      });
    }
    notFound();
  }
  if (result.status === 'unavailable') return <DataUnavailable />;
  const { product, household, journal } = result.data;
  const [t, common, stages, categories, preset, format, siblings] = await Promise.all([
    getTranslations('product'),
    getTranslations('common'),
    getTranslations('stages'),
    getTranslations('catalog.categories'),
    getTranslations('presetFigure'),
    getFormatter(),
    fetchProducts({ household: household.slug, limit: 5 }),
  ]);
  const log = toLogEntries(journal);
  const sold = product.status === 'SOLD';
  const tint = tintOf(product.traceCode);
  const image = photoFromUrl(
    product.coverUrl,
    altFor(locale, product.coverAlt ?? product.name, product.coverAltEn),
    product.coverVariants,
  );
  const presetKind = presetKindOf(product.category, product.name);
  // Only photos the household really attached to a journal entry are shown; there is no stand-in picture.
  const entryPhotos = log
    .slice(1, 5)
    .flatMap((e) => e.images.slice(0, 1).map((image) => ({ e, image })));
  // Slides of the lightbox: the cover when it is a real photo, then the journal photos, in page order.
  const coverSlide = gallerySlide(image);
  const entrySlides = entryPhotos.map(({ e, image: own }) =>
    gallerySlide(photoFromUrl(own.url, stages(`${e.stage}.name`), own.variants)),
  );
  const slides: GallerySlide[] = [coverSlide, ...entrySlides].filter(
    (slide): slide is GallerySlide => slide !== undefined,
  );
  const thumbOffset = coverSlide ? 1 : 0;
  const more =
    siblings.status === 'ok'
      ? siblings.data.data.filter((p) => p.slug !== product.slug).slice(0, 4)
      : [];

  const cover = (
    <ImageSlot
      alt={image?.alt ?? preset(presetKind)}
      tint={tint}
      ratio={image?.variants ? frameRatioOf(image.variants) : '4/5'}
      fit="contain"
      {...slotPhoto(image)}
      priority
      sizes="(min-width: 768px) 58vw, 100vw"
      className="grid place-items-center"
    >
      {image ? null : (
        <ProductFigure kind={presetKind} className="h-3/5" body="var(--color-paper)" band={tint} />
      )}
    </ImageSlot>
  );

  // schema.org Product for search results (GH#256); the price only when the household set one.
  const productLd = jsonLd({
    '@type': 'Product',
    name: product.name,
    description: product.description || undefined,
    sku: product.traceCode,
    category: categories(product.category),
    brand: { '@type': 'Brand', name: household.name },
    url: `${siteOrigin()}${localizedPath({ pathname: '/san-pham/[slug]', params: { slug: product.slug } }, locale)}`,
    ...(product.priceVnd > 0 && {
      offers: {
        '@type': 'Offer',
        price: product.priceVnd,
        priceCurrency: 'VND',
        availability:
          product.stock > 0 && !sold
            ? 'https://schema.org/InStock'
            : 'https://schema.org/OutOfStock',
      },
    }),
  });

  return (
    <article className="mx-auto max-w-editorial px-gutter pt-8">
      {/* biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD from our own data, `<` escaped. */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: productLd }} />
      <Breadcrumbs
        className="mb-8"
        items={[
          { label: common('home'), href: '/' },
          { label: t('allProducts'), href: '/san-pham' },
          { label: product.name },
        ]}
      />

      <div className="grid gap-10 md:grid-cols-12 md:gap-14">
        <div className="md:col-span-7">
          <ProductGallery slides={slides}>
            <div className="md:sticky md:top-24">
              <ViewTransition
                name={productImageTransition(product.slug)}
                share="product-morph"
                default="none"
              >
                {coverSlide ? (
                  <GalleryTrigger index={0} alt={coverSlide.alt}>
                    {cover}
                  </GalleryTrigger>
                ) : (
                  cover
                )}
              </ViewTransition>
              {entryPhotos.length > 0 ? (
                <ul className="mt-4 grid grid-cols-4 gap-3" aria-label={t('gallery')}>
                  {entryPhotos.map(({ e, image: own }, i) => {
                    const alt = stages(`${e.stage}.name`);
                    const thumb = (
                      <ImageSlot
                        alt={alt}
                        tint={e.tint}
                        ratio="1/1"
                        {...slotPhoto(photoFromUrl(own.url, alt, own.variants))}
                        sizes="(min-width: 768px) 14vw, 22vw"
                      />
                    );
                    return (
                      <li key={e.hash}>
                        {entrySlides[i] ? (
                          <GalleryTrigger index={thumbOffset + i} alt={alt}>
                            {thumb}
                          </GalleryTrigger>
                        ) : (
                          thumb
                        )}
                      </li>
                    );
                  })}
                </ul>
              ) : null}
            </div>
          </ProductGallery>
        </div>

        <div className="flex flex-col gap-8 md:col-span-5">
          <header className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="outline">{categories(product.category)}</Badge>
              {product.kind === 'OBJECT' ? (
                <Badge tone="seal">
                  <SealMark size={16} bleed={false} />
                  {common('oneOfAKind')}
                </Badge>
              ) : null}
              {sold ? <Badge tone="outline">{common('sold')}</Badge> : null}
            </div>
            <h1 className="text-h1">{product.name}</h1>
            <p className="text-ash">
              {t.rich('by', {
                household: household.name,
                link: (chunks) => (
                  <Link
                    href={{ pathname: '/nghe-nhan/[slug]', params: { slug: household.slug } }}
                    className="text-clay underline decoration-clay/40 underline-offset-4 hover:decoration-clay"
                  >
                    {chunks}
                  </Link>
                ),
              })}
            </p>
            <p className="font-display text-h2 text-ink type-soft">
              {product.priceVnd > 0
                ? format.number(product.priceVnd, 'vnd')
                : common('priceOnRequest')}
              <UsdReference vnd={product.priceVnd} className="ml-3 font-sans text-body text-ash" />
            </p>
            <UsdRateNote />
            <p className="text-small text-ash">
              {sold
                ? t('soldNote')
                : product.stock > 0
                  ? t('stock', { count: product.stock })
                  : t('soldOut')}
            </p>
          </header>

          <p className="max-w-prose-vn">{product.description}</p>

          {product.tags.length > 0 ? (
            <ul className="flex flex-wrap gap-2" aria-label={t('tags')}>
              {product.tags.map((tag) => (
                <li key={tag}>
                  <Badge tone="outline" className="normal-case">
                    {tag}
                  </Badge>
                </li>
              ))}
            </ul>
          ) : null}

          <div className="flex flex-wrap gap-3">
            {/* A sold piece cannot start a new quotation request. */}
            {sold ? null : (
              <Link href="/yeu-cau-bao-gia" className={buttonVariants({ size: 'lg' })}>
                {t('ctaRfq')}
              </Link>
            )}
            <Link
              href={{ pathname: '/nghe-nhan/[slug]', params: { slug: household.slug } }}
              className={buttonVariants({ variant: 'secondary', size: 'lg' })}
            >
              {t('ctaWorkshop')}
            </Link>
          </div>

          {/* Nhật ký rút gọn 1 dòng ⇒ landing truy xuất (BRAND §9). */}
          <JourneyCard entries={log} traceCode={product.traceCode} />

          <ProductQr code={product.traceCode} url={traceShortUrl(product.traceCode)} />

          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-3 border-ink/10 border-t pt-6 text-small">
            {product.material ? (
              <>
                <dt className="text-ash">{t('material')}</dt>
                <dd>{product.material}</dd>
              </>
            ) : null}
            {product.dimensions ? (
              <>
                <dt className="text-ash">{t('dimensions')}</dt>
                <dd>{product.dimensions}</dd>
              </>
            ) : null}
            {product.weightGrams ? (
              <>
                <dt className="text-ash">{t('weight')}</dt>
                <dd>
                  {format.number(product.weightGrams / 1000, { maximumFractionDigits: 1 })} kg
                </dd>
              </>
            ) : null}
            <dt className="text-ash">{t('code')}</dt>
            <dd className="font-mono tracking-widest">{product.traceCode}</dd>
          </dl>

          {product.artisanNote ? (
            <figure className="rounded-card bg-clay/8 p-6">
              <blockquote className="font-display text-h3 text-ink/90 italic">
                “{product.artisanNote}”
              </blockquote>
            </figure>
          ) : null}
        </div>
      </div>

      {more.length > 0 ? (
        <section className="pt-section" aria-labelledby="more-title">
          <h2 id="more-title">{t('more')}</h2>
          <ul className="mt-8 grid grid-cols-2 gap-6 md:grid-cols-4">
            {more.map((p) => (
              <li key={p.slug}>
                <ProductCard product={toProductCardView(p, locale)} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </article>
  );
}
