import { buttonVariants } from '@vcraft/ui';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { DataUnavailable } from '@/components/data-unavailable';
import { ImageSlot } from '@/components/image-slot';
import { EmptyState } from '@/components/states/empty-state';
import { UrlPagination } from '@/components/url-pagination';
import { fetchHouseholdPage } from '@/features/catalog/exhibition-api';
import { altFor, photoFromUrl, slotPhoto, tintOf } from '@/features/catalog/view-models';
import { Link } from '@/i18n/navigation';
import { resolveLocale } from '@/lib/locale';
import { parsePageParam } from '@/lib/page-param';

/** Households per numbered page: four rows of the three-column grid (GH#202). */
const HOUSEHOLD_PAGE_SIZE = 12;

// Danh sách lấy từ API lúc có yêu cầu (không dựng tĩnh lúc build, khi API có thể chưa chạy).
export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/nghe-nhan'>): Promise<Metadata> {
  await resolveLocale(params);
  const t = await getTranslations('indexPages.artisans');
  return { title: t('title'), description: t('lead') };
}

/**
 * Danh sách hộ nghệ nhân (FR-CAT-06): mỗi hộ đã duyệt một thẻ, lấy từ `GET /households`, in numbered
 * pages (`?page=N`, GH#202) rendered on the server.
 */
export default async function ArtisansIndexPage({
  params,
  searchParams,
}: PageProps<'/[locale]/nghe-nhan'>) {
  const locale = await resolveLocale(params);
  const page = parsePageParam((await searchParams).page);
  const [t, preset, nav, result] = await Promise.all([
    getTranslations('indexPages.artisans'),
    getTranslations('presetFigure'),
    getTranslations('nav'),
    fetchHouseholdPage(page, HOUSEHOLD_PAGE_SIZE),
  ]);
  if (result.status !== 'ok') return <DataUnavailable />;
  const households = result.data.data;

  return (
    <div className="mx-auto max-w-editorial px-gutter pt-12 pb-section-tail">
      <header className="flex max-w-prose-vn flex-col gap-3">
        <h1 className="text-h1">{t('title')}</h1>
        <p className="text-ash">{t('lead')}</p>
        <p className="text-small text-ash">{t('count', { count: result.data.total })}</p>
      </header>
      {households.length > 0 ? (
        <ul className="mt-10 grid gap-8 sm:grid-cols-2 md:grid-cols-3">
          {households.map((h, index) => {
            // What the cover really shows; a household without a photo gets an illustration label.
            const coverAlt = h.coverUrl
              ? altFor(locale, h.coverAlt ?? '', h.coverAltEn) || preset('household')
              : preset('household');
            return (
              <li key={h.slug}>
                <Link
                  href={{ pathname: '/nghe-nhan/[slug]', params: { slug: h.slug } }}
                  className="group block"
                >
                  <ImageSlot
                    alt={coverAlt}
                    tint={tintOf(h.slug)}
                    ratio="3/4"
                    {...slotPhoto(photoFromUrl(h.coverUrl, coverAlt, h.coverVariants))}
                    sizes="(min-width: 768px) 30vw, (min-width: 640px) 50vw, 100vw"
                    priority={index < 3}
                    className="motion-safe:transition-transform motion-safe:duration-(--duration-slow) motion-safe:ease-clay motion-safe:group-hover:-translate-y-1"
                  />
                  <h2 className="mt-4 text-h3 transition-colors group-hover:text-clay">{h.name}</h2>
                  <p className="text-small text-ash">
                    {[h.representative, h.craft].filter(Boolean).join(' · ')}
                  </p>
                  <p className="mt-1 text-small text-ash">
                    {t('productCount', { count: h.productCount })}
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState
          className="mt-10"
          illustration="vase"
          title={t('empty')}
          description={t('emptyHint')}
          action={
            <Link href="/san-pham" className={buttonVariants({ variant: 'secondary' })}>
              {nav('products')}
            </Link>
          }
        />
      )}
      <div className="mt-12">
        <UrlPagination
          kind="households"
          page={result.data.page}
          totalPages={result.data.totalPages}
          total={result.data.total}
          pageSize={result.data.pageSize}
        />
      </div>
    </div>
  );
}
