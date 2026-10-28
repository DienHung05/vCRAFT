import { Badge, buttonVariants, cn, TraceSealFrame, VaseFigure, WaveDivider } from '@vcraft/ui';
import { getFormatter, getTranslations } from 'next-intl/server';
import { ImageSlot } from '@/components/image-slot';
import { VillageMiniMap } from '@/features/village-map/village-mini-map';
import { Link } from '@/i18n/navigation';
import { getArtisans, getNews, getProducts, getVillageStats, type LogStage } from '@/lib/demo/data';
import { resolveLocale } from '@/lib/locale';

const DAY_STAGES: readonly { stage: LogStage; tint: string }[] = [
  { stage: 'clay', tint: '#a88d6c' },
  { stage: 'throw', tint: '#8a5a3c' },
  { stage: 'dry', tint: '#c9b28f' },
  { stage: 'paint', tint: '#3b5079' },
  { stage: 'fire', tint: '#c2522a' },
  { stage: 'finish', tint: '#3f5a8a' },
];

export default async function HomePage({ params }: PageProps<'/[locale]'>) {
  await resolveLocale(params);
  const [t, stages, format, artisans, products, news, stats] = await Promise.all([
    getTranslations('home'),
    getTranslations('stages'),
    getFormatter(),
    getArtisans(),
    getProducts(),
    getNews(),
    getVillageStats(),
  ]);
  const featured = artisans.slice(0, 3);
  const showcase = products[0];

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
                href={{ pathname: '/truy-xuat/[code]', params: { code: showcase.code } }}
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
            className="grid place-items-center"
          >
            <VaseFigure className="h-[72%] drop-shadow-[0_24px_40px_rgb(30_58_110/0.35)]" />
          </ImageSlot>
          {showcase ? (
            <div className="absolute -bottom-6 -left-4 hidden rotate-[-4deg] rounded-card bg-paper p-3 shadow-warm sm:block">
              <TraceSealFrame code={showcase.code} size={112} title={t('hero.sealAlt')}>
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
        <ol className="mt-10 flex snap-x snap-mandatory gap-5 overflow-x-auto scroll-smooth px-gutter pb-4 motion-reduce:scroll-auto">
          {DAY_STAGES.map(({ stage, tint }, i) => (
            <li key={stage} className="w-[78vw] max-w-sm shrink-0 snap-start sm:w-80">
              <ImageSlot alt={stages(`${stage}.name`)} tint={tint} ratio="3/4">
                <span className="absolute top-4 left-4 font-mono text-small text-paper/90">
                  {String(i + 1).padStart(2, '0')}
                </span>
              </ImageSlot>
              <h3 className="mt-4">{stages(`${stage}.name`)}</h3>
              <p className="mt-1 text-small text-ash">{stages(`${stage}.text`)}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Nghệ nhân nổi bật: chân dung lớn, bố cục lệch kiểu tạp chí. */}
      <section
        className="mx-auto max-w-editorial px-gutter pb-section"
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
        <ul className="mt-10 grid gap-8 md:grid-cols-3">
          {featured.map((a, i) => (
            <li key={a.slug} className={cn(i === 1 && 'md:mt-16')}>
              <Link
                href={{ pathname: '/nghe-nhan/[slug]', params: { slug: a.slug } }}
                className="group block"
              >
                <ImageSlot
                  alt={t('artisans.portraitAlt', { name: a.artisanName })}
                  tint={a.tint}
                  ratio="3/4"
                  className="transition-transform duration-(--duration-slow) ease-clay group-hover:-translate-y-1"
                />
                <div className="mt-4 flex items-baseline justify-between gap-3">
                  <h3 className="transition-colors group-hover:text-clay">{a.household}</h3>
                  <span className="font-mono text-small text-ash">{a.foundedYear}</span>
                </div>
                <p className="text-small text-ash">
                  {a.artisanName} · {a.craft}
                </p>
                <p className="mt-3 font-display text-ink/80 italic">“{a.quote}”</p>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* Bản đồ thu nhỏ "đang mở cửa" + số liệu làng. */}
      <section className="bg-glaze text-paper" aria-labelledby="map-title">
        <div className="mx-auto grid max-w-editorial gap-12 px-gutter py-section md:grid-cols-12">
          <div className="md:col-span-5">
            <h2 id="map-title" className="text-paper">
              {t('map.title')}
            </h2>
            <p className="mt-3 text-paper/75">{t('map.lead')}</p>
            <ul className="mt-8 space-y-3">
              {artisans.map((a) => (
                <li
                  key={a.slug}
                  className="flex items-center justify-between gap-4 border-paper/15 border-b pb-3"
                >
                  <span>{a.household}</span>
                  <span className="flex items-center gap-2 text-small text-paper/75">
                    <span
                      aria-hidden="true"
                      className={cn(
                        'size-2 rounded-full',
                        a.openNow ? 'bg-celadon' : 'bg-paper/30',
                      )}
                    />
                    {a.openNow ? t('map.open', { hours: a.hours }) : t('map.closed')}
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <div className="md:col-span-7">
            <VillageMiniMap
              label={t('map.mapLabel')}
              pins={artisans.map((a) => ({
                id: a.slug,
                x: a.pin.x,
                y: a.pin.y,
                open: a.openNow,
                label: a.household,
              }))}
            />
          </div>
        </div>
      </section>

      <section
        className="mx-auto max-w-editorial px-gutter py-section"
        aria-labelledby="stats-title"
      >
        <h2 id="stats-title" className="sr-only">
          {t('stats.title')}
        </h2>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-10 md:grid-cols-4">
          {(['households', 'products', 'scans', 'years'] as const).map((key) => (
            <div key={key} className="border-clay/40 border-t pt-4">
              <dt className="text-small text-ash">{t(`stats.${key}`)}</dt>
              <dd className="mt-1 font-display text-h1 text-glaze type-soft">
                {key === 'years' ? `${stats[key]}+` : format.number(stats[key])}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="mx-auto max-w-editorial px-gutter" aria-labelledby="news-title">
        <div className="flex items-end justify-between gap-4">
          <h2 id="news-title">{t('news.title')}</h2>
        </div>
        <ul className="mt-8 grid gap-6 md:grid-cols-3">
          {news.map((n) => (
            <li key={n.slug} className="flex flex-col gap-3">
              <ImageSlot alt={n.title} tint={n.tint} ratio="3/2" />
              <div className="flex items-center gap-3">
                <Badge tone="outline">{n.tag}</Badge>
                <time dateTime={n.date} className="text-small text-ash">
                  {format.dateTime(new Date(n.date), 'long')}
                </time>
              </div>
              <h3 className="text-[1.25rem] leading-snug">{n.title}</h3>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
