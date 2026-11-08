import type { NewsCategoryDto } from '@vcraft/contracts';
import { NEWS_CATEGORIES } from '@vcraft/domain';
import { Badge, buttonVariants, Card } from '@vcraft/ui';
import { useFormatter, useLocale, useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { DataUnavailable } from '@/components/data-unavailable';
import { ImageSlot } from '@/components/image-slot';
import { EmptyState } from '@/components/states/empty-state';
import { UrlPagination } from '@/components/url-pagination';
import { altFor, photoFromUrl, slotPhoto, tintOf } from '@/features/catalog/view-models';
import { Link } from '@/i18n/navigation';
import type { NewsResult } from './news-api';

interface NewsViewProps {
  result: NewsResult;
  /** Bộ lọc `?household=` đang áp dụng. */
  householdSlug?: string | undefined;
  category?: NewsCategoryDto | undefined;
  children?: ReactNode;
}

/** Trang tin tức công khai: đầu trang, danh sách tin (ghim trước) và liên kết "Xem thêm" theo con trỏ. */
export function NewsView({
  result,
  householdSlug,
  category: selectedCategory,
  children,
}: NewsViewProps) {
  const t = useTranslations('indexPages.news');
  const category = useTranslations('indexPages.news.categories');
  const nav = useTranslations('nav');
  const format = useFormatter();
  const locale = useLocale();
  const items = result.status === 'ok' ? result.page.data : [];
  const nextCursor = result.status === 'ok' ? result.page.nextCursor : null;
  // Numbered pages when the page came with totals (GH#202); the cursor link is the fallback.
  const counters = result.status === 'ok' && 'totalPages' in result.page ? result.page : null;
  const householdName = items.find((n) => n.householdSlug === householdSlug)?.householdName;
  const categoryHref = (value?: NewsCategoryDto) => ({
    pathname: '/tin-tuc' as const,
    query: {
      ...(householdSlug ? { household: householdSlug } : {}),
      ...(value ? { category: value } : {}),
    },
  });
  const categoryClass = (active: boolean) =>
    `inline-flex min-h-11 items-center rounded-chip border px-3 py-2 text-small transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay ${active ? 'border-clay bg-clay/12 text-clay-ink' : 'border-ink/15 text-ash hover:border-clay hover:text-clay-ink'}`;

  return (
    <div className="mx-auto max-w-editorial px-gutter pt-12 pb-section">
      <header className="flex max-w-prose-vn flex-col gap-3">
        <h1 className="text-h1">{t('title')}</h1>
        <p className="text-ash">{t('lead')}</p>
        {result.status === 'ok' && (
          <p className="text-small text-ash">
            {t('count', { count: counters?.total ?? items.length })}
          </p>
        )}
      </header>

      <nav aria-label={t('categoryFilter')} className="mt-6 flex flex-wrap gap-2">
        <Link
          href={categoryHref()}
          aria-current={selectedCategory === undefined ? 'page' : undefined}
          className={categoryClass(selectedCategory === undefined)}
        >
          {t('allNews')}
        </Link>
        {NEWS_CATEGORIES.map((value) => (
          <Link
            key={value}
            href={categoryHref(value)}
            aria-current={selectedCategory === value ? 'page' : undefined}
            className={categoryClass(selectedCategory === value)}
          >
            {category(value)}
          </Link>
        ))}
      </nav>

      {householdSlug && (
        <p className="mt-6 text-small text-ash">
          {t('filteredBy', { name: householdName ?? householdSlug })}{' '}
          <Link href="/tin-tuc" className="text-clay underline underline-offset-4">
            {t('clearFilter')}
          </Link>
        </p>
      )}

      {children}

      {result.status === 'unavailable' && (
        <DataUnavailable className="mt-10" message={t('unavailable')} />
      )}
      {result.status === 'ok' && items.length === 0 && (
        <EmptyState
          className="mt-10"
          illustration="scroll"
          title={t('empty')}
          description={t('emptyHint')}
          action={
            <Link
              href={householdSlug ? '/tin-tuc' : '/san-pham'}
              className={buttonVariants({ variant: 'secondary' })}
            >
              {householdSlug ? t('clearFilter') : nav('products')}
            </Link>
          }
        />
      )}

      {items.length > 0 && (
        <ul aria-label={t('listLabel')} className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-2">
          {items.map((n) => (
            <li key={n.slug}>
              <Card className="h-full p-5 md:p-6">
                <article className="flex flex-col gap-2">
                  {n.cover ? (
                    <div className="mb-2">
                      <ImageSlot
                        alt={altFor(locale, n.cover.alt || n.title, n.cover.altEn)}
                        tint={tintOf(n.slug)}
                        ratio="3/2"
                        {...slotPhoto(
                          photoFromUrl(
                            n.cover.url,
                            altFor(locale, n.cover.alt || n.title, n.cover.altEn),
                            n.cover.variants,
                          ),
                        )}
                        sizes="(min-width: 768px) 40rem, 100vw"
                      />
                    </div>
                  ) : null}
                  <div className="flex flex-wrap items-center gap-2 text-small text-ash">
                    {n.pinned && <Badge tone="seal">{t('pinned')}</Badge>}
                    <Badge tone="clay">{category(n.category)}</Badge>
                    <time dateTime={n.publishedAt}>
                      {format.dateTime(new Date(n.publishedAt), 'long')}
                    </time>
                  </div>
                  <h2 className="text-h3">
                    <Link
                      href={{ pathname: '/tin-tuc/[slug]', params: { slug: n.slug } }}
                      className="transition-colors hover:text-clay"
                    >
                      {n.title}
                    </Link>
                  </h2>
                  <p className="text-ash">{n.summary}</p>
                  <p className="text-small text-ash">
                    {n.householdSlug && n.householdName ? (
                      <Link
                        href={{ pathname: '/tin-tuc', query: { household: n.householdSlug } }}
                        className="text-clay underline underline-offset-4"
                      >
                        {t('byHousehold', { name: n.householdName })}
                      </Link>
                    ) : (
                      t('village')
                    )}
                  </p>
                </article>
              </Card>
            </li>
          ))}
        </ul>
      )}

      {counters ? (
        <div className="mt-10 max-w-prose-vn">
          <UrlPagination
            kind="news"
            page={counters.page}
            totalPages={counters.totalPages}
            total={counters.total}
            pageSize={counters.pageSize}
          />
        </div>
      ) : null}

      {!counters && nextCursor && (
        <p className="mt-8">
          <Link
            href={{
              pathname: '/tin-tuc',
              query: {
                cursor: nextCursor,
                ...(householdSlug && { household: householdSlug }),
                ...(selectedCategory && { category: selectedCategory }),
              },
            }}
            className="text-clay underline underline-offset-4"
          >
            {t('more')} →
          </Link>
        </p>
      )}
    </div>
  );
}
