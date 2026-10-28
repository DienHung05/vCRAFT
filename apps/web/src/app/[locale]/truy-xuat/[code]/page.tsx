import { Badge, buttonVariants, Crackle, Logo, TraceSealFrame, VaseFigure } from '@vcraft/ui';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { ImageSlot } from '@/components/image-slot';
import { LocaleSwitcher } from '@/components/shell/locale-switcher';
import { ChainVerifier } from '@/features/traceability/chain-verifier';
import { FireTimeline } from '@/features/traceability/fire-timeline';
import { TraceQr } from '@/features/traceability/trace-qr';
import { VillageMiniMap } from '@/features/village-map/village-mini-map';
import { Link } from '@/i18n/navigation';
import { demoParams, getArtisan, getProductByCode } from '@/lib/demo/data';
import { resolveLocale } from '@/lib/locale';
import { isTraceCode, traceShortUrl } from '@/lib/site';

export function generateStaticParams() {
  return demoParams.traceCodes.map((code) => ({ code }));
}

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/truy-xuat/[code]'>): Promise<Metadata> {
  const { code } = await params;
  const p = await getProductByCode(code);
  return { title: p ? p.name : code, robots: { index: false } };
}

/**
 * Landing truy xuất (FR-TRC-04, BRAND §9): mobile-first như một cuốn sổ nghề — ảnh → ấn xác thực →
 * lời nghệ nhân → dòng thời gian lửa → bản đồ mini → chứng nhận → "Ghé xưởng".
 */
export default async function TracePage({ params }: PageProps<'/[locale]/truy-xuat/[code]'>) {
  await resolveLocale(params);
  const { code } = await params;
  // Mã sai định dạng (BR-04) là đường dẫn sai ⇒ 404; mã đúng định dạng mà không có trong hệ thống
  // thì hiện cảnh báo hàng không xác thực bên dưới (FR-TRC-08).
  if (!isTraceCode(code)) notFound();
  const t = await getTranslations('trace');
  const product = await getProductByCode(code);
  const artisan = product ? await getArtisan(product.artisanSlug) : null;

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
        {!product || !artisan ? (
          // FR-TRC-08: mã không tồn tại ⇒ cảnh báo hàng không xác thực.
          <section className="relative mx-5 mt-6 overflow-hidden rounded-card border border-seal/40 p-8 text-center">
            <Crackle className="text-seal" opacity={0.25} />
            <VaseFigure className="relative mx-auto h-20 opacity-60" body="var(--color-ash)" />
            <h1 className="relative mt-6 text-h2 text-seal">{t('notFoundTitle')}</h1>
            <p className="relative mt-3 text-ink/85">
              {t('notFoundText', { code: code.toUpperCase() })}
            </p>
            <Link href="/" className={`${buttonVariants({ variant: 'secondary' })} relative mt-6`}>
              {t('home')}
            </Link>
          </section>
        ) : (
          <>
            <ImageSlot
              alt={product.name}
              tint={product.tint}
              ratio="4/5"
              className="mx-5 grid place-items-center"
            >
              <VaseFigure className="h-3/5" body="var(--color-paper)" band={product.tint} />
            </ImageSlot>

            <section className="px-5 pt-8">
              <p className="text-small text-ash">{t('scanned')}</p>
              <h1 className="mt-1 text-h1">{product.name}</h1>
              <p className="mt-2 text-ash">
                {artisan.household} · {artisan.artisanName}
              </p>
            </section>

            {/* Ấn xác thực (BRAND §6.3 #2): chỉ đóng ấn khi trình duyệt tự kiểm chuỗi băm khớp (FR-TRC-05). */}
            <ChainVerifier
              productId={product.code}
              entries={product.log}
              household={artisan.household}
            />
            <p className="mx-5 mt-3 text-small text-ash">{t('scans', { count: product.scans })}</p>

            {product.artisanNote ? (
              <figure className="px-5 pt-10">
                <blockquote className="font-display text-h3 leading-snug text-ink type-soft">
                  “{product.artisanNote}”
                </blockquote>
                <figcaption className="mt-4 flex items-center gap-3 text-small text-ash">
                  <ImageSlot
                    alt={artisan.artisanName}
                    tint={artisan.tint}
                    className="size-10 rounded-full"
                  />
                  {artisan.artisanName} · {artisan.title}
                </figcaption>
              </figure>
            ) : null}

            <section aria-labelledby="journey-title" className="px-5 pt-12">
              <h2 id="journey-title">{t('timelineTitle')}</h2>
              <p className="mt-2 mb-8 text-small text-ash">{t('timelineLead')}</p>
              <FireTimeline entries={product.log} />
            </section>

            <section aria-labelledby="where-title" className="px-5 pt-12">
              <h2 id="where-title">{t('whereTitle')}</h2>
              <p className="mt-2 mb-5 text-small text-ash">{artisan.address}</p>
              <VillageMiniMap
                label={t('whereTitle')}
                pins={[
                  {
                    id: artisan.slug,
                    x: 50,
                    y: 58,
                    open: artisan.openNow,
                    label: artisan.household,
                  },
                ]}
                highlight={artisan.slug}
              />
            </section>

            {artisan.certifications.length > 0 ? (
              <section aria-labelledby="certs-title" className="px-5 pt-12">
                <h2 id="certs-title">{t('certsTitle')}</h2>
                <ul className="mt-5 flex flex-wrap gap-2">
                  {artisan.certifications
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
                code={product.code}
                size={200}
                title={t('qrLabel', { code: product.code })}
              >
                <TraceQr url={traceShortUrl(product.code)} size={136} />
              </TraceSealFrame>
              <p className="mt-4 text-center text-small text-ash">
                {t('shortLink')}:{' '}
                <a
                  href={traceShortUrl(product.code)}
                  className="font-mono text-clay underline underline-offset-4"
                >
                  {traceShortUrl(product.code).replace(/^https?:\/\//, '')}
                </a>
              </p>
            </section>

            <nav className="sticky bottom-0 mt-12 flex gap-3 border-ink/10 border-t bg-paper/90 px-5 py-4 backdrop-blur-md">
              <Link
                href={{ pathname: '/nghe-nhan/[slug]', params: { slug: artisan.slug } }}
                className={`${buttonVariants({ size: 'lg' })} flex-1`}
              >
                {t('ctaVisit')}
              </Link>
              <Link
                href="/yeu-cau-bao-gia"
                className={`${buttonVariants({ variant: 'secondary', size: 'lg' })} flex-1`}
              >
                {t('ctaRfq')}
              </Link>
            </nav>
          </>
        )}
      </main>
    </div>
  );
}
