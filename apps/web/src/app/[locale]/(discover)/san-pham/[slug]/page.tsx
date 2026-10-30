import { Badge, buttonVariants, Card, cn, SealMark, VaseFigure } from '@vcraft/ui';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getFormatter, getTranslations } from 'next-intl/server';
import { ImageSlot } from '@/components/image-slot';
import { PhotoCredit } from '@/components/photo-credit';
import { PhotoCreditsNote } from '@/components/photo-credits-note';
import { ProductCard } from '@/features/catalog/product-card';
import { Link } from '@/i18n/navigation';
import { demoParams, getArtisan, getProduct, getProductsByArtisan } from '@/lib/demo/data';
import { squarePhoto } from '@/lib/demo/stage-photos';
import { resolveLocale } from '@/lib/locale';

export function generateStaticParams() {
  return demoParams.products.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/san-pham/[slug]'>): Promise<Metadata> {
  const { slug } = await params;
  const p = await getProduct(slug);
  return p ? { title: p.name, description: p.description } : {};
}

/** Chi tiết sản phẩm (FR-PRD, BRAND §9): ảnh 4:5 sticky bên trái, thông tin bên phải, nhật ký rút gọn. */
export default async function ProductPage({ params }: PageProps<'/[locale]/san-pham/[slug]'>) {
  await resolveLocale(params);
  const { slug } = await params;
  const product = await getProduct(slug);
  if (!product) notFound();
  const [t, common, stages, format, artisan, siblings] = await Promise.all([
    getTranslations('product'),
    getTranslations('common'),
    getTranslations('stages'),
    getFormatter(),
    getArtisan(product.artisanSlug),
    getProductsByArtisan(product.artisanSlug),
  ]);
  const first = product.log[0];
  const last = product.log.at(-1);
  const more = siblings.filter((p) => p.slug !== product.slug).slice(0, 4);

  return (
    <article className="mx-auto max-w-editorial px-gutter pt-8">
      <nav aria-label={t('breadcrumb')} className="mb-8 text-small text-ash">
        <Link href="/san-pham" className="hover:text-ink">
          {t('allProducts')}
        </Link>
        <span aria-hidden="true"> / </span>
        <span aria-current="page" className="text-ink">
          {product.name}
        </span>
      </nav>

      <div className="grid gap-10 md:grid-cols-12 md:gap-14">
        <div className="md:col-span-7">
          <div className="md:sticky md:top-24">
            <ImageSlot
              alt={product.name}
              tint={product.tint}
              ratio="4/5"
              photo={product.photo}
              priority
              sizes="(min-width: 768px) 58vw, 100vw"
              className="grid place-items-center"
            >
              {product.photo ? null : (
                <VaseFigure className="h-3/5" body="var(--color-paper)" band={product.tint} />
              )}
            </ImageSlot>
            {product.photo ? <PhotoCredit id={product.photo.id} /> : null}
            <ul className="mt-4 grid grid-cols-4 gap-3" aria-label={t('gallery')}>
              {product.log.slice(1, 5).map((e) => (
                <li key={e.stage}>
                  <ImageSlot
                    alt={stages(`${e.stage}.name`)}
                    tint={e.tint}
                    ratio="1/1"
                    photo={squarePhoto(e.stage)}
                    sizes="(min-width: 768px) 14vw, 22vw"
                  />
                </li>
              ))}
            </ul>
            {product.log.length > 0 ? <PhotoCreditsNote /> : null}
          </div>
        </div>

        <div className="flex flex-col gap-8 md:col-span-5">
          <header className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="outline">{product.category}</Badge>
              {product.oneOfAKind ? (
                <Badge tone="seal">
                  <SealMark size={16} bleed={false} />
                  {common('oneOfAKind')}
                </Badge>
              ) : null}
            </div>
            <h1 className="text-h1">{product.name}</h1>
            {artisan ? (
              <p className="text-ash">
                {t.rich('by', {
                  household: artisan.household,
                  link: (chunks) => (
                    <Link
                      href={{ pathname: '/nghe-nhan/[slug]', params: { slug: artisan.slug } }}
                      className="text-clay underline decoration-clay/40 underline-offset-4 hover:decoration-clay"
                    >
                      {chunks}
                    </Link>
                  ),
                })}
              </p>
            ) : null}
            <p className="font-display text-h2 text-ink type-soft">
              {format.number(product.price, 'vnd')}
            </p>
            <p className="text-small text-ash">
              {product.stock > 0 ? t('stock', { count: product.stock }) : t('soldOut')}
            </p>
          </header>

          <p className="max-w-prose-vn">{product.description}</p>

          <div className="flex flex-wrap gap-3">
            <Link href="/yeu-cau-bao-gia" className={buttonVariants({ size: 'lg' })}>
              {t('ctaRfq')}
            </Link>
            {artisan ? (
              <Link
                href={{ pathname: '/nghe-nhan/[slug]', params: { slug: artisan.slug } }}
                className={buttonVariants({ variant: 'secondary', size: 'lg' })}
              >
                {t('ctaWorkshop')}
              </Link>
            ) : null}
          </div>

          {/* Nhật ký rút gọn 1 dòng ⇒ landing truy xuất (BRAND §9). */}
          {first && last ? (
            <Card className="flex flex-col gap-4 p-6">
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-sans text-body font-semibold text-ink">{t('journey')}</h2>
                <span className="font-mono text-small text-ash">{product.code}</span>
              </div>
              <ol className="flex items-center" aria-label={t('journey')}>
                {product.log.map((e, i) => (
                  <li key={e.hash} className="flex flex-1 items-center last:flex-none">
                    <span
                      title={stages(`${e.stage}.name`)}
                      className="size-3 shrink-0 rounded-full ring-2 ring-surface"
                      style={{ background: e.tint }}
                    />
                    {i < product.log.length - 1 ? (
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
                  count: product.log.length,
                  from: format.dateTime(new Date(first.at), 'short'),
                  to: format.dateTime(new Date(last.at), 'short'),
                })}
              </p>
              <Link
                href={{ pathname: '/truy-xuat/[code]', params: { code: product.code } }}
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
            <dt className="text-ash">{t('material')}</dt>
            <dd>{product.material}</dd>
            <dt className="text-ash">{t('dimensions')}</dt>
            <dd>{product.dimensions}</dd>
            <dt className="text-ash">{t('weight')}</dt>
            <dd>{format.number(product.weightGrams / 1000, { maximumFractionDigits: 1 })} kg</dd>
            <dt className="text-ash">{t('code')}</dt>
            <dd className="font-mono tracking-widest">{product.code}</dd>
          </dl>

          {product.artisanNote ? (
            <figure className="rounded-card bg-clay/8 p-6">
              <blockquote className="font-display text-h3 text-ink/90 italic">
                “{product.artisanNote}”
              </blockquote>
              {artisan ? (
                <figcaption className="mt-3 text-small text-ash">
                  — {artisan.artisanName}
                </figcaption>
              ) : null}
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
                <ProductCard product={p} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </article>
  );
}
