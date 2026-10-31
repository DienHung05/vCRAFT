import { buttonVariants, Card, cn, SealMark, WaveDivider } from '@vcraft/ui';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { DataUnavailable } from '@/components/data-unavailable';
import { ImageSlot } from '@/components/image-slot';
import { PhotoCredit } from '@/components/photo-credit';
import { fetchHousehold } from '@/features/catalog/exhibition-api';
import { ProductCard } from '@/features/catalog/product-card';
import {
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
  await resolveLocale(params);
  const { slug } = await params;
  const [t, ex, result] = await Promise.all([
    getTranslations('artisan'),
    getTranslations('exhibition'),
    fetchHousehold(slug),
  ]);
  if (result.status === 'not-found') notFound();
  if (result.status === 'unavailable') return <DataUnavailable />;

  const household = result.data;
  const representative = household.artisans[0];
  const cover = photoFromUrl(household.coverUrl, t('coverAlt', { household: household.name }));
  const featured = household.products[0];
  const story = household.history.split(/\n{2,}/).filter(Boolean);

  return (
    <article>
      {/* Hero toàn màn: ảnh xưởng + tên hộ Fraunces cực lớn. */}
      <header className="relative">
        <ImageSlot
          alt={t('coverAlt', { household: household.name })}
          tint={tintOf(household.slug)}
          {...slotPhoto(cover)}
          priority
          sizes="100vw"
          className="h-[78svh] min-h-[28rem] rounded-none"
        />
        <div className="absolute inset-0 bg-linear-to-t from-ink/85 via-ink/40 to-ink/10" />
        <div className="absolute inset-x-0 bottom-0 mx-auto max-w-editorial px-gutter pb-12">
          <nav aria-label={t('breadcrumb')} className="mb-6 text-small text-paper/75">
            <Link href="/nghe-nhan" className="hover:text-paper">
              {t('allArtisans')}
            </Link>
            <span aria-hidden="true"> / </span>
            <span aria-current="page">{household.name}</span>
          </nav>
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
      {cover?.photo ? (
        <div className="mx-auto max-w-editorial px-gutter">
          <PhotoCredit id={cover.photo.id} className="mt-2 text-right text-[0.75rem] text-ash" />
        </div>
      ) : null}

      <section
        className="mx-auto max-w-editorial px-gutter py-section"
        aria-label={t('bentoLabel')}
      >
        <Card className="p-8">
          <h2 className="text-h3">{t('story')}</h2>
          {story.map((paragraph) => (
            <p key={paragraph.slice(0, 24)} className="mt-4 max-w-prose-vn">
              {paragraph}
            </p>
          ))}
        </Card>
      </section>

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
                <ProductCard product={toProductCardView({ ...p, household })} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-6 text-ash">{t('productsEmpty')}</p>
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
