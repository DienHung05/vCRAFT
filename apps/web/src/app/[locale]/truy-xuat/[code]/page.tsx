import {
  Badge,
  buttonVariants,
  Crackle,
  Logo,
  ProductFigure,
  TraceSealFrame,
  VaseFigure,
} from '@vcraft/ui';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { DataUnavailable } from '@/components/data-unavailable';
import { ImageSlot } from '@/components/image-slot';
import { LocaleSwitcher } from '@/components/shell/locale-switcher';
import { fetchHousehold, fetchTrace } from '@/features/catalog/exhibition-api';
import {
  altFor,
  householdCover,
  photoFromUrl,
  slotPhoto,
  tintOf,
  toLogEntries,
  toVisitWorkshops,
} from '@/features/catalog/view-models';
import { MakerCredits } from '@/features/exhibition/maker-credits';
import { VisitSection } from '@/features/exhibition/visit-section';
import { ChainVerifier } from '@/features/traceability/chain-verifier';
import { FireTimeline } from '@/features/traceability/fire-timeline';
import { pieceKindOf } from '@/features/traceability/piece-shapes';
import { TraceQr } from '@/features/traceability/trace-qr';
import { Link } from '@/i18n/navigation';
import { frameRatioOf } from '@/lib/images';
import { resolveLocale } from '@/lib/locale';
import { isTraceCode, traceShortUrl } from '@/lib/site';

// Tra mã qua API lúc có yêu cầu (không dựng tĩnh lúc build, khi API có thể chưa chạy).
export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/truy-xuat/[code]'>): Promise<Metadata> {
  const { code } = await params;
  const result = await fetchTrace(code);
  // A published trace code is indexable (NFR-PERF-02); unknown, withdrawn or locked codes are not.
  if (result.status === 'ok' && result.data.availability === 'VISIBLE')
    return { title: result.data.product.name };
  return { title: code, robots: { index: false } };
}

/**
 * Landing truy xuất — biến thể C "quét mã mở sổ" (vCRAFT-9hg.6), mobile-first: ấn xác thực và nhật ký
 * (mốc theo thứ tự thời gian, cũ nhất trước) → người làm → món đồ và hộ → ghé thăm (phòng trưng bày tách khỏi xưởng, bản đồ
 * kèm danh sách) → chứng nhận → tem QR, kèm liên kết về trang chủ.
 */
/** Lets the sticky call-to-action buttons shrink and wrap instead of pushing the page sideways. */
const CTA_FIT = 'h-auto min-h-13 min-w-0 flex-1 shrink whitespace-normal py-2 text-center';

export default async function TracePage({ params }: PageProps<'/[locale]/truy-xuat/[code]'>) {
  const locale = await resolveLocale(params);
  const { code } = await params;
  // Mã sai định dạng (BR-04) là đường dẫn sai ⇒ 404; mã đúng định dạng mà không có trong hệ thống
  // thì hiện cảnh báo hàng không xác thực bên dưới (FR-TRC-08).
  if (!isTraceCode(code)) notFound();
  const [t, ex, preset, common] = await Promise.all([
    getTranslations('trace'),
    getTranslations('exhibition'),
    getTranslations('presetFigure'),
    getTranslations('common'),
  ]);
  const result = await fetchTrace(code);
  if (result.status === 'unavailable') return <DataUnavailable />;
  const trace = result.status === 'ok' ? result.data : null;
  // Mã không có, hoặc hộ làm ra nó đã bị khóa, là cảnh báo hàng không xác thực; sản phẩm tự rút thì chỉ là thông báo.
  const withdrawn = trace?.availability === 'UNAVAILABLE' && trace.reason === 'PRODUCT_WITHDRAWN';
  const locked = trace?.availability === 'UNAVAILABLE' && trace.reason === 'HOUSEHOLD_SUSPENDED';
  const visible = trace?.availability === 'VISIBLE' ? trace : null;
  const profile = visible ? await fetchHousehold(visible.household.slug) : null;
  // The product's own photo, only when it has one; there is no stand-in picture for a product.
  const image = visible
    ? photoFromUrl(
        visible.product.coverUrl,
        altFor(
          locale,
          visible.product.coverAlt ?? visible.product.name,
          visible.product.coverAltEn,
        ),
        visible.product.coverVariants,
      )
    : undefined;
  // The household slot shows the household's own banner when it has one, else a workshop illustration.
  const household = profile?.status === 'ok' ? profile.data : null;
  const householdPhoto = household ? householdCover(locale, household) : undefined;
  const householdAlt = householdPhoto?.alt || preset('household');
  const householdImage = householdPhoto?.view && { ...householdPhoto.view, alt: householdAlt };

  return (
    <div className="mx-auto min-h-svh max-w-xl bg-paper">
      <header className="flex items-center justify-between px-5 py-4">
        <Link href="/" aria-label={t('home')}>
          <Logo size={26} />
        </Link>
        <span className="font-mono text-[0.7rem] tracking-[0.25em] text-ash uppercase">
          {t('book')}
        </span>
        <LocaleSwitcher />
      </header>

      <main id="main">
        {withdrawn ? (
          <section className="mx-5 mt-6 rounded-card border border-ink/15 p-8 text-center">
            <VaseFigure className="mx-auto h-20 opacity-60" body="var(--color-ash)" />
            <h1 className="mt-6 text-h2">{t('withdrawnTitle')}</h1>
            <p className="mt-3 text-ink/85">{t('withdrawnText')}</p>
            <Link href="/" className={`${buttonVariants({ variant: 'secondary' })} mt-6`}>
              {t('home')}
            </Link>
          </section>
        ) : !visible ? (
          // FR-TRC-08: mã không tồn tại hoặc hộ bị khóa ⇒ cảnh báo hàng không xác thực.
          <section className="relative mx-5 mt-6 overflow-hidden rounded-card border border-seal/40 p-8 text-center">
            <Crackle className="text-seal" opacity={0.25} />
            <VaseFigure className="relative mx-auto h-20 opacity-60" body="var(--color-ash)" />
            <h1 className="relative mt-6 text-h2 text-seal">
              {t(locked ? 'lockedTitle' : 'notFoundTitle')}
            </h1>
            <p className="relative mt-3 text-ink/85">
              {locked
                ? t('lockedText', { code: code.toUpperCase() })
                : t('notFoundText', { code: code.toUpperCase() })}
            </p>
            <Link href="/" className={`${buttonVariants({ variant: 'secondary' })} relative mt-6`}>
              {t('home')}
            </Link>
          </section>
        ) : (
          <>
            <section className="px-5 pt-6">
              <p className="text-small text-ash">{t('scanned')}</p>
              <h1 className="mt-1 text-h1">{visible.product.name}</h1>
              <p className="mt-2 text-ash">{visible.household.name}</p>
              {visible.product.status === 'SOLD' ? (
                <Badge tone="outline" className="mt-3">
                  {common('sold')}
                </Badge>
              ) : null}
              {image ? (
                <figure className="mt-5 max-w-xs">
                  <ImageSlot
                    alt={image.alt}
                    tint={tintOf(visible.product.traceCode)}
                    ratio={image.variants ? frameRatioOf(image.variants) : '4/5'}
                    fit="contain"
                    {...slotPhoto(image)}
                    priority
                    sizes="(min-width: 640px) 20rem, 80vw"
                  />
                </figure>
              ) : null}
            </section>

            {/* Biến thể C: mở ngay bằng ấn và nhật ký. Ấn chỉ đóng khi trình duyệt tự kiểm chuỗi băm khớp. */}
            <ChainVerifier
              productId={visible.journal.productId}
              entries={toLogEntries(visible.journal)}
              household={visible.household.name}
              householdVerified={visible.household.status === 'APPROVED'}
            />
            <p className="mx-5 mt-3 text-small text-ash">
              {t('scans', { count: visible.scanCount })}
            </p>

            <section aria-labelledby="journey-title" className="px-5 pt-12">
              <h2 id="journey-title">{t('timelineTitle')}</h2>
              <p className="mt-2 mb-8 text-small text-ash">{t('timelineLead')}</p>
              <FireTimeline
                entries={toLogEntries(visible.journal)}
                household={visible.household.name}
                pieceKind={pieceKindOf(visible.product.category, visible.product.name)}
                glaze={tintOf(visible.product.traceCode)}
              />
            </section>

            <MakerCredits
              compact
              className="px-5 pt-12"
              household={visible.household.name}
              makers={visible.product.makers.map((m) => ({
                name: m.name,
                detail: m.contribution,
              }))}
            />

            {/* Đi ngược về món đồ và hộ làm ra nó. */}
            <section aria-labelledby="household-title" className="px-5 pt-12">
              <h2 id="household-title">{ex('householdTitle')}</h2>
              <ImageSlot
                alt={householdAlt}
                tint={tintOf(visible.household.slug)}
                ratio="3/2"
                {...slotPhoto(householdImage)}
                sizes="(min-width: 640px) 32rem, 100vw"
                className="mt-6 grid place-items-center"
              >
                {householdImage ? null : (
                  <ProductFigure
                    kind="generic"
                    className="h-1/2"
                    body="var(--color-paper)"
                    band={tintOf(visible.household.slug)}
                  />
                )}
              </ImageSlot>
              {visible.product.artisanNote ? (
                <blockquote className="mt-6 font-display text-h3 leading-snug text-ink type-soft">
                  “{visible.product.artisanNote}”
                </blockquote>
              ) : null}
              <Link
                href={{ pathname: '/nghe-nhan/[slug]', params: { slug: visible.household.slug } }}
                className={`${buttonVariants({ variant: 'secondary' })} mt-6`}
              >
                {ex('householdCta', { household: visible.household.name })}
              </Link>
            </section>

            <VisitSection
              className="px-5 pt-12"
              household={visible.household.name}
              workshops={profile?.status === 'ok' ? toVisitWorkshops(profile.data.workshops) : []}
            />

            {profile?.status === 'ok' && profile.data.certifications.some((c) => c.verified) ? (
              <section aria-labelledby="certs-title" className="px-5 pt-12">
                <h2 id="certs-title">{t('certsTitle')}</h2>
                <ul className="mt-5 flex flex-wrap gap-2">
                  {profile.data.certifications
                    .filter((c) => c.verified)
                    .map((c) => (
                      <li key={c.name}>
                        <Badge tone="lacquer">
                          {c.name} · {c.year}
                        </Badge>
                      </li>
                    ))}
                </ul>
              </section>
            ) : null}

            {/* Ấn truy xuất: chính cái tem ở đáy sản phẩm. */}
            <section className="flex flex-col items-center px-5 pt-14">
              <TraceSealFrame
                code={visible.product.traceCode}
                size={200}
                title={t('qrLabel', { code: visible.product.traceCode })}
              >
                <TraceQr url={traceShortUrl(visible.product.traceCode)} size={136} />
              </TraceSealFrame>
              <p className="mt-4 text-center text-small text-ash">
                {t('shortLink')}:{' '}
                <a
                  href={traceShortUrl(visible.product.traceCode)}
                  className="font-mono text-clay underline underline-offset-4"
                >
                  {traceShortUrl(visible.product.traceCode).replace(/^https?:\/\//, '')}
                </a>
              </p>
              <Link href="/" className="mt-6 text-small text-clay underline underline-offset-4">
                {ex('homeLink')}
              </Link>
            </section>

            <nav className="sticky bottom-0 mt-12 flex gap-3 border-ink/10 border-t bg-paper/90 px-5 py-4 backdrop-blur-md">
              {/* Both labels share the row and wrap when the English text is long (GH#257). */}
              <a href="#workshop" className={`${buttonVariants({ size: 'lg' })} ${CTA_FIT}`}>
                {t('ctaVisit')}
              </a>
              {/* A sold piece cannot start a new quotation request. */}
              {visible.product.status === 'SOLD' ? null : (
                <Link
                  href={{
                    pathname: '/yeu-cau-bao-gia/moi',
                    query: { product: visible.product.traceCode },
                  }}
                  className={`${buttonVariants({ variant: 'secondary', size: 'lg' })} ${CTA_FIT}`}
                >
                  {t('ctaRfq')}
                </Link>
              )}
            </nav>
          </>
        )}
      </main>
    </div>
  );
}
