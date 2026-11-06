import { Badge, buttonVariants, Card, cn, ProductFigure, SealMark } from '@vcraft/ui';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getFormatter, getTranslations } from 'next-intl/server';
import { ViewTransition } from 'react';
import { Breadcrumbs } from '@/components/breadcrumbs';
import { DataUnavailable } from '@/components/data-unavailable';
import { ImageSlot } from '@/components/image-slot';
import { PhotoCredit } from '@/components/photo-credit';
import { PhotoCreditsNote } from '@/components/photo-credits-note';
import { UsdRateNote, UsdReference } from '@/components/usd-reference';
import { fetchProduct, fetchProducts, fetchSlugRedirect } from '@/features/catalog/exhibition-api';
import { presetKindOf } from '@/features/catalog/preset-figure';
import { ProductCard, productImageTransition } from '@/features/catalog/product-card';
import {
  altFor,
  photoFromUrl,
  slotPhoto,
  tintOf,
  toLogEntries,
  toProductCardView,
} from '@/features/catalog/view-models';
import { Link, permanentRedirect } from '@/i18n/navigation';
import { frameRatioOf } from '@/lib/images';
import { resolveLocale } from '@/lib/locale';

// Dữ liệu lấy từ API lúc có yêu cầu (không dựng tĩnh lúc build, khi API có thể chưa chạy).
export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/san-pham/[slug]'>): Promise<Metadata> {
  const { slug } = await params;
  const result = await fetchProduct(slug);
  return result.status === 'ok'
    ? { title: result.data.product.name, description: result.data.product.description }
    : {};
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
  const { product, coverCredit, household, journal } = result.data;
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
  const first = log[0];
  const last = log.at(-1);
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
  const more =
    siblings.status === 'ok'
      ? siblings.data.data.filter((p) => p.slug !== product.slug).slice(0, 4)
      : [];

  return (
    <article className="mx-auto max-w-editorial px-gutter pt-8">
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
          <div className="md:sticky md:top-24">
            <ViewTransition
              name={productImageTransition(product.slug)}
              share="product-morph"
              default="none"
            >
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
                  <ProductFigure
                    kind={presetKind}
                    className="h-3/5"
                    body="var(--color-paper)"
                    band={tint}
                  />
                )}
              </ImageSlot>
            </ViewTransition>
            <PhotoCredit id={image?.photo?.id} credit={coverCredit} />
            {entryPhotos.length > 0 ? (
              <ul className="mt-4 grid grid-cols-4 gap-3" aria-label={t('gallery')}>
                {entryPhotos.map(({ e, image: own }) => {
                  const alt = stages(`${e.stage}.name`);
                  return (
                    <li key={e.hash}>
                      <ImageSlot
                        alt={alt}
                        tint={e.tint}
                        ratio="1/1"
                        {...slotPhoto(photoFromUrl(own.url, alt, own.variants))}
                        sizes="(min-width: 768px) 14vw, 22vw"
                      />
                    </li>
                  );
                })}
              </ul>
            ) : null}
            {image || entryPhotos.length > 0 ? <PhotoCreditsNote /> : null}
          </div>
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
              {product.stock > 0 ? t('stock', { count: product.stock }) : t('soldOut')}
            </p>
          </header>

          <p className="max-w-prose-vn">{product.description}</p>

          <div className="flex flex-wrap gap-3">
            <Link href="/yeu-cau-bao-gia" className={buttonVariants({ size: 'lg' })}>
              {t('ctaRfq')}
            </Link>
            <Link
              href={{ pathname: '/nghe-nhan/[slug]', params: { slug: household.slug } }}
              className={buttonVariants({ variant: 'secondary', size: 'lg' })}
            >
              {t('ctaWorkshop')}
            </Link>
          </div>

          {/* Nhật ký rút gọn 1 dòng ⇒ landing truy xuất (BRAND §9). */}
          {first && last ? (
            <Card className="flex flex-col gap-4 p-6">
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-sans text-body font-semibold text-ink">{t('journey')}</h2>
                <span className="font-mono text-small text-ash">{product.traceCode}</span>
              </div>
              <ol className="flex items-center" aria-label={t('journey')}>
                {log.map((e, i) => (
                  <li key={e.hash} className="flex flex-1 items-center last:flex-none">
                    <span
                      title={stages(`${e.stage}.name`)}
                      className="size-3 shrink-0 rounded-full ring-2 ring-surface"
                      style={{ background: e.tint }}
                    />
                    {i < log.length - 1 ? (
                      <span
                        aria-hidden="true"
                        className="h-0.5 flex-1 bg-linear-to-r from-clay/50 to-seal/50"
                      />
                    ) : null}
                  </li>
                ))}
              </ol>
              <p className="text-small text-ash">
                {t('journeySummary', {
                  count: log.length,
                  from: format.dateTime(new Date(first.at), 'short'),
                  to: format.dateTime(new Date(last.at), 'short'),
                })}
              </p>
              <Link
                href={{ pathname: '/truy-xuat/[code]', params: { code: product.traceCode } }}
                className={cn(
                  buttonVariants({ variant: 'ghost', size: 'sm' }),
                  'self-start px-0 text-clay hover:bg-transparent hover:underline',
                )}
              >
                {t('journeyCta')} →
              </Link>
            </Card>
          ) : null}

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
