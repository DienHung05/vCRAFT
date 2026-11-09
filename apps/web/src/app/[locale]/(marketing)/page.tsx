import { buttonVariants, WaveDivider } from '@vcraft/ui';
import { getTranslations } from 'next-intl/server';
import { Suspense } from 'react';
import { ImageSlot } from '@/components/image-slot';
import { HeroVase } from '@/experience/hero-vase/hero-vase';
import { TurningVase } from '@/experience/hero-vase/turning-vase';
import { DayStory } from '@/experience/motion/day-story';
import { HandUnderline } from '@/experience/motion/hand-underline';
import { InkCursor } from '@/experience/motion/ink-cursor';
import { Magnetic } from '@/experience/motion/magnetic';
import { PressedHeadline } from '@/experience/motion/pressed-headline';
import { Reveal } from '@/experience/motion/reveal';
import { FeaturedArtisans } from '@/features/home/home-artisans';
import { HomeMiniMap, HomeWorkshopList } from '@/features/home/home-map';
import { HomeNews } from '@/features/home/home-news';
import { HeroTraceCta, HeroTraceSeal } from '@/features/home/home-showcase';
import { VillageStats } from '@/features/home/home-stats';
import { Link } from '@/i18n/navigation';
import type { LogStage } from '@/lib/demo/data';
import { dayPhoto } from '@/lib/demo/stage-photos';
import { resolveLocale } from '@/lib/locale';

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

/**
 * Trang chủ. Hero, "một ngày" và mọi tiêu đề section nằm trong HTML đầu tiên; chỉ phần dữ liệu
 * (sản phẩm của ấn truy xuất, nghệ nhân, bản đồ, số liệu, tin) đi qua Suspense riêng, nên bình gốm
 * và tiêu đề không phải chờ API. Fetch bên dưới vẫn `no-store` (xem `exhibition-api`).
 */
export default async function HomePage({ params }: PageProps<'/[locale]'>) {
  const locale = await resolveLocale(params);
  const [t, stages] = await Promise.all([getTranslations('home'), getTranslations('stages')]);

  return (
    <>
      <InkCursor />
      {/* Hero: the forming, turning 3D vase (BRAND §6.3 #1, experience/hero-vase) over the hand-drawn vase. */}
      <section
        id="home-hero"
        className="mx-auto grid max-w-editorial items-center gap-10 px-gutter pt-12 pb-section md:grid-cols-12 md:pt-20"
      >
        <div className="flex flex-col gap-7 md:col-span-7">
          <PressedHeadline className="text-display leading-[1.02] type-soft">
            {t('hero.title')}
          </PressedHeadline>
          <p className="-mt-3 text-small text-ash">{t('hero.eyebrow')}</p>
          <p className="max-w-prose-vn text-ash">{t('hero.lead')}</p>
          <div className="flex flex-wrap gap-3">
            <Magnetic>
              <Link href="/san-pham" className={buttonVariants({ size: 'lg' })}>
                {t('hero.ctaExplore')}
              </Link>
            </Magnetic>
            {/* Reserve the second action's row on phones while its product loads. */}
            <div className="min-h-12 basis-full sm:basis-auto">
              <Suspense fallback={null}>
                <HeroTraceCta />
              </Suspense>
            </div>
          </div>
        </div>
        <div className="relative md:col-span-5">
          <ImageSlot
            alt={t('hero.vaseAlt')}
            tint="#d9c6a6"
            ratio="4/5"
            className="grid place-items-center"
          >
            {/* GH#316: no photo and never the flat figure. The shaded, CSS-turning vase is in the first
                HTML and is the fallback on every device; on capable desktops the WebGL vase (GH#94)
                cross-fades in over it, in the same box, once its first frame has been drawn. */}
            <TurningVase className="absolute inset-0 size-full" />
            <HeroVase sectionId="home-hero" />
          </ImageSlot>
          <Suspense fallback={null}>
            <HeroTraceSeal />
          </Suspense>
        </div>
      </section>

      <WaveDivider />

      {/* Một ngày ở Bát Tràng: kể theo cuộn ngang, sáu chặng khớp nhật ký sản xuất. */}
      <section className="py-section" aria-labelledby="day-title">
        <div className="mx-auto max-w-editorial px-gutter">
          <h2 id="day-title">
            <HandUnderline>{t('day.title')}</HandUnderline>
          </h2>
          <p className="mt-3 max-w-prose-vn text-ash">{t('day.lead')}</p>
        </div>
        {/* GH#210: on wide screens with motion allowed the strip becomes a pinned story, one stage at a time. */}
        <DayStory
          labelledBy="day-title"
          stageNames={DAY_STAGES.map(({ stage }) => stages(`${stage}.name`))}
          // No `scroll-smooth` here: with mandatory snap it makes Chrome report no LCP at all (NO_LCP in Lighthouse).
          className="mt-10 snap-x snap-mandatory overflow-x-auto focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-glaze"
        >
          <ol className="day-stages flex w-max gap-5 px-gutter pb-4">
            {DAY_STAGES.map(({ stage, tint }, i) => (
              <li
                key={stage}
                data-day-stage={stage}
                className="w-[78vw] max-w-sm shrink-0 snap-start sm:w-80"
              >
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
        </DayStory>
      </section>

      {/* Nghệ nhân nổi bật: chân dung lớn, bố cục lệch kiểu tạp chí. */}
      <section
        className="cv-auto mx-auto max-w-editorial px-gutter pb-section"
        aria-labelledby="artisans-title"
      >
        {/* GH#301: reveal the whole block once (images keep their ink-bleed inside it). */}
        <Reveal>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 id="artisans-title">{t('artisans.title')}</h2>
              <p className="mt-3 max-w-prose-vn text-ash">{t('artisans.lead')}</p>
            </div>
            <Link href="/nghe-nhan" className={buttonVariants({ variant: 'ghost' })}>
              {t('artisans.all')} →
            </Link>
          </div>
          <Suspense fallback={null}>
            <FeaturedArtisans locale={locale} />
          </Suspense>
        </Reveal>
      </section>

      {/* Bản đồ thu nhỏ "đang mở cửa" + số liệu làng. */}
      <section className="cv-auto bg-glaze text-paper" aria-labelledby="map-title">
        <div className="mx-auto grid max-w-editorial gap-12 px-gutter pt-section pb-section-tail md:grid-cols-12">
          <div className="md:col-span-5">
            <h2 id="map-title" className="text-paper">
              {t('map.title')}
            </h2>
            <p className="mt-3 text-paper/75">{t('map.lead')}</p>
            <Suspense fallback={null}>
              <HomeWorkshopList />
            </Suspense>
            <Link
              href="/ban-do"
              className="mt-6 inline-block text-paper underline underline-offset-4"
            >
              {t('map.cta')}
            </Link>
          </div>
          <div className="md:col-span-7">
            <Suspense fallback={null}>
              <HomeMiniMap />
            </Suspense>
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
        <Suspense fallback={null}>
          <VillageStats locale={locale} />
        </Suspense>
      </section>

      <section
        className="cv-auto mx-auto max-w-editorial px-gutter pt-section pb-section-tail"
        aria-labelledby="news-title"
      >
        <Reveal>
          <div className="flex items-end justify-between gap-4">
            <h2 id="news-title">{t('news.title')}</h2>
          </div>
          <Suspense fallback={null}>
            <HomeNews locale={locale} />
          </Suspense>
        </Reveal>
      </section>
    </>
  );
}
