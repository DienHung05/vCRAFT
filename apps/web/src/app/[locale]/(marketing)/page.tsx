import { buttonVariants, cn, TraceSealFrame, VaseFigure, WaveDivider } from '@vcraft/ui';
import { getFormatter, getTranslations } from 'next-intl/server';
import { DataUnavailable } from '@/components/data-unavailable';
import { ImageSlot } from '@/components/image-slot';
import { PhotoCredit } from '@/components/photo-credit';
import { PhotoCreditsNote } from '@/components/photo-credits-note';
import { EmptyState } from '@/components/states/empty-state';
import {
  fetchHouseholds,
  fetchProducts,
  fetchVillageStats,
} from '@/features/catalog/exhibition-api';
import {
  altFor,
  photoFromUrl,
  projectPins,
  slotPhoto,
  tintOf,
} from '@/features/catalog/view-models';
import { fetchNews } from '@/features/news/news-api';
import { fetchMapPins, pinOpenState } from '@/features/village-map/map-model';
import { VillageMiniMap } from '@/features/village-map/village-mini-map';
import { Link } from '@/i18n/navigation';
import type { DemoPhotoRef, LogStage } from '@/lib/demo/data';
import { dayPhoto } from '@/lib/demo/stage-photos';
import { resolveLocale } from '@/lib/locale';

/** Ảnh hero thật (có giấy phép); bỏ đi thì quay về hình bình vẽ tay. */
const HERO_PHOTO: DemoPhotoRef | undefined = {
  id: 'hero-binh-chu-dau',
  alt: 'Chiếc bình gốm men ngà vẽ lam hoa mẫu đơn, cổ cao thon, bụng tròn, đặt trong một cửa hàng gốm',
  altKey: 'hero-binh-chu-dau',
};

const DAY_STAGES: readonly { stage: LogStage; tint: string }[] = [
  { stage: 'clay', tint: '#a88d6c' },
  { stage: 'throw', tint: '#8a5a3c' },
  { stage: 'dry', tint: '#c9b28f' },
  { stage: 'paint', tint: '#3b5079' },
  { stage: 'fire', tint: '#c2522a' },
  { stage: 'finish', tint: '#3f5a8a' },
];

// Số liệu và danh sách lấy từ API lúc có yêu cầu (không dựng tĩnh lúc build, khi API có thể chưa chạy).
export const dynamic = 'force-dynamic';

/** Làng gốm Bát Tràng có từ khoảng thế kỷ 14 (số tròn, không phải số liệu trong CSDL). */
const VILLAGE_YEARS = 700;

export default async function HomePage({ params }: PageProps<'/[locale]'>) {
  const locale = await resolveLocale(params);
  const [
    t,
    stages,
    common,
    preset,
    format,
    householdsResult,
    productsResult,
    newsResult,
    statsResult,
    pinsResult,
  ] = await Promise.all([
    getTranslations('home'),
    getTranslations('stages'),
    getTranslations('common'),
    getTranslations('presetFigure'),
    getFormatter(),
    fetchHouseholds(),
    fetchProducts({ limit: 1 }),
    fetchNews({ limit: 3 }),
    fetchVillageStats(),
    fetchMapPins(),
  ]);
  const households = householdsResult.status === 'ok' ? householdsResult.data.data : [];
  const featured = households.filter((h) => h.coverUrl).slice(0, 3);
  const showcase = productsResult.status === 'ok' ? productsResult.data.data[0] : undefined;
  const now = new Date();
  const pins = pinsResult.status === 'ok' ? pinsResult.pins : [];
  const visitable = pins.filter((pin) => pin.visitable).slice(0, 6);
  const positions = projectPins(
    pins.map((pin) => ({ id: pin.workshopId, lat: pin.lat, lng: pin.lng })),
  );

  return (
    <>
      {/* Hero: ảnh tĩnh bình đã ra lò; bản 3D (BRAND §6.3 #1) nạp lười ở experience/hero-vase. */}
      <section className="mx-auto grid max-w-editorial items-center gap-10 px-gutter pt-12 pb-section md:grid-cols-12 md:pt-20">
        <div className="flex flex-col gap-7 md:col-span-7">
          <p className="text-small font-medium tracking-[0.18em] text-clay uppercase">
            {t('hero.eyebrow')}
          </p>
          <h1 className="text-display leading-[1.02] type-soft">{t('hero.title')}</h1>
          <p className="max-w-prose-vn text-ash">{t('hero.lead')}</p>
          <div className="flex flex-wrap gap-3">
            <Link href="/san-pham" className={buttonVariants({ size: 'lg' })}>
              {t('hero.ctaExplore')}
            </Link>
            {showcase ? (
              <Link
                href={{ pathname: '/truy-xuat/[code]', params: { code: showcase.traceCode } }}
                className={buttonVariants({ variant: 'secondary', size: 'lg' })}
              >
                {t('hero.ctaTrace')}
              </Link>
            ) : null}
          </div>
        </div>
        <div className="relative md:col-span-5">
          <ImageSlot
            alt={t('hero.vaseAlt')}
            tint="#d9c6a6"
            ratio="4/5"
            photo={HERO_PHOTO}
            priority
            // 88vw (not 100vw) so phones at 1.75x pick the 640w file: the box is ~92vw wide.
            sizes="(min-width: 768px) 40vw, 88vw"
            className="grid place-items-center"
          >
            {HERO_PHOTO ? null : (
              <VaseFigure className="h-[72%] drop-shadow-[0_24px_40px_rgb(30_58_110/0.35)]" />
            )}
          </ImageSlot>
          {HERO_PHOTO ? (
            <PhotoCredit id={HERO_PHOTO.id} className="mt-1.5 text-right text-[0.75rem] text-ash" />
          ) : null}
          {showcase ? (
            <div className="absolute -bottom-6 -left-4 hidden rotate-[-4deg] rounded-card bg-paper p-3 shadow-warm sm:block">
              <TraceSealFrame code={showcase.traceCode} size={112} title={t('hero.sealAlt')}>
                <span className="font-display text-h3 text-seal type-wonk">vC</span>
              </TraceSealFrame>
            </div>
          ) : null}
        </div>
      </section>

      <WaveDivider />

      {/* Một ngày ở Bát Tràng: kể theo cuộn ngang, sáu chặng khớp nhật ký sản xuất. */}
      <section className="py-section" aria-labelledby="day-title">
        <div className="mx-auto max-w-editorial px-gutter">
          <h2 id="day-title">{t('day.title')}</h2>
          <p className="mt-3 max-w-prose-vn text-ash">{t('day.lead')}</p>
        </div>
        {/* biome-ignore lint/a11y/useSemanticElements: a named group around a scroller, not a form fieldset; a second `section` would repeat the landmark name. */}
        <div
          role="group"
          aria-labelledby="day-title"
          // biome-ignore lint/a11y/noNoninteractiveTabindex: vùng cuộn ngang phải nhận focus để cuộn bằng phím mũi tên (WCAG 2.1.1, axe scrollable-region-focusable).
          tabIndex={0}
          // No `scroll-smooth` here: with mandatory snap it makes Chrome report no LCP at all (NO_LCP in Lighthouse).
          className="mt-10 snap-x snap-mandatory overflow-x-auto focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-glaze"
        >
          <ol className="flex w-max gap-5 px-gutter pb-4">
            {DAY_STAGES.map(({ stage, tint }, i) => (
              <li key={stage} className="w-[78vw] max-w-sm shrink-0 snap-start sm:w-80">
                <ImageSlot
                  alt={stages(`${stage}.name`)}
                  tint={tint}
                  ratio="3/4"
                  photo={dayPhoto(stage)}
                  sizes="(min-width: 640px) 20rem, 78vw"
                >
                  <span className="absolute top-4 left-4 rounded-chip bg-ink/70 px-2 font-mono text-small text-paper">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                </ImageSlot>
                <h3 className="mt-4">{stages(`${stage}.name`)}</h3>
                <p className="mt-1 text-small text-ash">{stages(`${stage}.text`)}</p>
              </li>
            ))}
          </ol>
        </div>
        <PhotoCreditsNote className="mx-auto mt-4 max-w-editorial px-gutter text-[0.75rem] leading-snug text-ash" />
      </section>

      {/* Nghệ nhân nổi bật: chân dung lớn, bố cục lệch kiểu tạp chí. */}
      <section
        className="cv-auto mx-auto max-w-editorial px-gutter pb-section"
        aria-labelledby="artisans-title"
      >
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 id="artisans-title">{t('artisans.title')}</h2>
            <p className="mt-3 max-w-prose-vn text-ash">{t('artisans.lead')}</p>
          </div>
          <Link href="/nghe-nhan" className={buttonVariants({ variant: 'ghost' })}>
            {t('artisans.all')} →
          </Link>
        </div>
        {householdsResult.status !== 'ok' ? (
          <DataUnavailable className="mt-10 flex flex-col items-start gap-3" />
        ) : featured.length === 0 ? (
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
        ) : (
          <ul className="mt-10 grid gap-8 md:grid-cols-3">
            {featured.map((h, i) => {
              const coverAlt =
                altFor(locale, h.coverAlt ?? '', h.coverAltEn) || preset('household');
              return (
                <li key={h.slug} className={cn(i === 1 && 'md:mt-16')}>
                  <Link
                    href={{ pathname: '/nghe-nhan/[slug]', params: { slug: h.slug } }}
                    className="group block"
                  >
                    <ImageSlot
                      alt={coverAlt}
                      tint={tintOf(h.slug)}
                      ratio="3/4"
                      {...slotPhoto(photoFromUrl(h.coverUrl, coverAlt, h.coverVariants))}
                      sizes="(min-width: 768px) 30vw, 100vw"
                      className="transition-transform duration-(--duration-slow) ease-clay group-hover:-translate-y-1"
                    />
                    <h3 className="mt-4 transition-colors group-hover:text-clay">{h.name}</h3>
                    <p className="text-small text-ash">
                      {[h.representative, h.craft].filter(Boolean).join(' · ')}
                    </p>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
        <PhotoCreditsNote />
      </section>

      {/* Bản đồ thu nhỏ "đang mở cửa" + số liệu làng. */}
      <section className="cv-auto bg-glaze text-paper" aria-labelledby="map-title">
        <div className="mx-auto grid max-w-editorial gap-12 px-gutter py-section md:grid-cols-12">
          <div className="md:col-span-5">
            <h2 id="map-title" className="text-paper">
              {t('map.title')}
            </h2>
            <p className="mt-3 text-paper/75">{t('map.lead')}</p>
            {pinsResult.status === 'ok' && visitable.length === 0 ? (
              <p className="mt-8 text-paper/75">{t('map.empty')}</p>
            ) : pinsResult.status === 'ok' ? (
              <ul className="mt-8 space-y-3">
                {visitable.map((pin) => {
                  const state = pinOpenState(pin, now);
                  return (
                    <li
                      key={pin.workshopId}
                      className="flex items-center justify-between gap-4 border-paper/15 border-b pb-3"
                    >
                      <span>{pin.household.name}</span>
                      <span className="flex items-center gap-2 text-small text-paper/75">
                        <span
                          aria-hidden="true"
                          className={cn(
                            'size-2 rounded-full',
                            state.open ? 'bg-celadon' : 'bg-paper/30',
                          )}
                        />
                        {state.open ? t('map.open', { hours: state.closesAt }) : t('map.closed')}
                      </span>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="mt-8 text-paper/75">{common('dataUnavailable')}</p>
            )}
            <Link
              href="/ban-do"
              className="mt-6 inline-block text-paper underline underline-offset-4"
            >
              {t('map.cta')}
            </Link>
          </div>
          <div className="md:col-span-7">
            <VillageMiniMap
              label={t('map.mapLabel')}
              pins={visitable.map((pin) => ({
                id: pin.workshopId,
                ...(positions.get(pin.workshopId) ?? { x: 50, y: 50 }),
                open: pinOpenState(pin, now).open,
                label: pin.household.name,
              }))}
            />
          </div>
        </div>
      </section>

      <section
        className="cv-auto mx-auto max-w-editorial px-gutter py-section"
        aria-labelledby="stats-title"
      >
        <h2 id="stats-title" className="sr-only">
          {t('stats.title')}
        </h2>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-10 md:grid-cols-4">
          {(['households', 'products', 'artisans', 'years'] as const).map((key) => {
            const value =
              key === 'years'
                ? `${VILLAGE_YEARS}+`
                : statsResult.status === 'ok'
                  ? format.number(statsResult.data[key])
                  : '—';
            return (
              <div key={key} className="border-clay/40 border-t pt-4">
                <dt className="text-small text-ash">{t(`stats.${key}`)}</dt>
                <dd className="mt-1 font-display text-h1 text-glaze type-soft">{value}</dd>
              </div>
            );
          })}
        </dl>
      </section>

      <section className="cv-auto mx-auto max-w-editorial px-gutter" aria-labelledby="news-title">
        <div className="flex items-end justify-between gap-4">
          <h2 id="news-title">{t('news.title')}</h2>
        </div>
        {newsResult.status === 'ok' && newsResult.page.data.length === 0 ? (
          <EmptyState
            className="mt-6"
            illustration="scroll"
            headingLevel="h3"
            title={t('news.empty')}
            action={
              <Link href="/tin-tuc" className={buttonVariants({ variant: 'secondary' })}>
                {t('news.all')}
              </Link>
            }
          />
        ) : newsResult.status === 'ok' ? (
          <ul className="mt-8 grid gap-6 md:grid-cols-3">
            {newsResult.page.data.map((n) => (
              <li key={n.slug} className="flex flex-col gap-3">
                <div>
                  <ImageSlot
                    alt={altFor(locale, n.cover?.alt || n.title, n.cover?.altEn)}
                    tint={tintOf(n.slug)}
                    ratio="3/2"
                    {...slotPhoto(
                      photoFromUrl(
                        n.cover?.url ?? null,
                        altFor(locale, n.cover?.alt || n.title, n.cover?.altEn),
                        n.cover?.variants,
                      ),
                    )}
                  />
                  <PhotoCredit credit={n.cover?.credit} />
                </div>
                <time dateTime={n.publishedAt} className="text-small text-ash">
                  {format.dateTime(new Date(n.publishedAt), 'long')}
                </time>
                <h3 className="text-[1.25rem] leading-snug">{n.title}</h3>
              </li>
            ))}
          </ul>
        ) : (
          <DataUnavailable className="mt-8 flex flex-col items-start gap-3" />
        )}
      </section>
    </>
  );
}
