import { buttonVariants } from '@vcraft/ui';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { DataUnavailable } from '@/components/data-unavailable';
import { ImageSlot } from '@/components/image-slot';
import { PhotoCreditsNote } from '@/components/photo-credits-note';
import { EmptyState } from '@/components/states/empty-state';
import { fetchHouseholds } from '@/features/catalog/exhibition-api';
import { photoFromUrl, slotPhoto, tintOf } from '@/features/catalog/view-models';
import { Link } from '@/i18n/navigation';
import { resolveLocale } from '@/lib/locale';

// Danh sách lấy từ API lúc có yêu cầu (không dựng tĩnh lúc build, khi API có thể chưa chạy).
export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/nghe-nhan'>): Promise<Metadata> {
  await resolveLocale(params);
  const t = await getTranslations('indexPages.artisans');
  return { title: t('title'), description: t('lead') };
}

/** Danh sách hộ nghệ nhân (FR-CAT-06): mỗi hộ đã duyệt một thẻ, lấy từ `GET /households`. */
export default async function ArtisansIndexPage({ params }: PageProps<'/[locale]/nghe-nhan'>) {
  await resolveLocale(params);
  const [t, artisan, nav, result] = await Promise.all([
    getTranslations('indexPages.artisans'),
    getTranslations('artisan'),
    getTranslations('nav'),
    fetchHouseholds(),
  ]);
  if (result.status !== 'ok') return <DataUnavailable />;
  const households = result.data.data;

  return (
    <div className="mx-auto max-w-editorial px-gutter pt-12 pb-section">
      <header className="flex max-w-prose-vn flex-col gap-3">
        <h1 className="text-h1">{t('title')}</h1>
        <p className="text-ash">{t('lead')}</p>
        <p className="text-small text-ash">{t('count', { count: households.length })}</p>
      </header>
      {households.length > 0 ? (
        <ul className="mt-10 grid gap-8 sm:grid-cols-2 md:grid-cols-3">
          {households.map((h) => (
            <li key={h.slug}>
              <Link
                href={{ pathname: '/nghe-nhan/[slug]', params: { slug: h.slug } }}
                className="group block"
              >
                <ImageSlot
                  alt={artisan('coverAlt', { household: h.name })}
                  tint={tintOf(h.slug)}
                  ratio="3/4"
                  {...slotPhoto(
                    photoFromUrl(h.coverUrl, artisan('coverAlt', { household: h.name })),
                  )}
                  sizes="(min-width: 768px) 30vw, (min-width: 640px) 50vw, 100vw"
                  className="transition-transform duration-(--duration-slow) ease-clay group-hover:-translate-y-1"
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
          ))}
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
      <PhotoCreditsNote />
    </div>
  );
}
