import { Badge, Card } from '@vcraft/ui';
import { useFormatter, useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import type { NewsResult } from './news-api';

interface NewsViewProps {
  result: NewsResult;
  /** Bộ lọc `?household=` đang áp dụng. */
  householdSlug?: string | undefined;
}

/** Trang tin tức công khai: đầu trang, danh sách tin (ghim trước) và liên kết "Xem thêm" theo con trỏ. */
export function NewsView({ result, householdSlug }: NewsViewProps) {
  const t = useTranslations('indexPages.news');
  const category = useTranslations('indexPages.news.categories');
  const format = useFormatter();
  const items = result.status === 'ok' ? result.page.data : [];
  const nextCursor = result.status === 'ok' ? result.page.nextCursor : null;
  const householdName = items.find((n) => n.householdSlug === householdSlug)?.householdName;

  return (
    <div className="mx-auto max-w-editorial px-gutter pt-12 pb-section">
      <header className="flex max-w-prose-vn flex-col gap-3">
        <Badge tone="outline" className="self-start whitespace-normal">
          {t('demoNote')}
        </Badge>
        <h1 className="text-h1">{t('title')}</h1>
        <p className="text-ash">{t('lead')}</p>
        {result.status === 'ok' && (
          <p className="text-small text-ash">{t('count', { count: items.length })}</p>
        )}
      </header>

      {householdSlug && (
        <p className="mt-6 text-small text-ash">
          {t('filteredBy', { name: householdName ?? householdSlug })}{' '}
          <Link href="/tin-tuc" className="text-clay underline underline-offset-4">
            {t('clearFilter')}
          </Link>
        </p>
      )}

      {result.status === 'unavailable' && (
        <p role="status" className="mt-10 text-ash">
          {t('unavailable')}
        </p>
      )}
      {result.status === 'ok' && items.length === 0 && (
        <p className="mt-10 text-ash">{t('empty')}</p>
      )}

      {items.length > 0 && (
        <ul aria-label={t('listLabel')} className="mt-10 flex max-w-prose-vn flex-col gap-4">
          {items.map((n) => (
            <li key={n.slug}>
              <Card className="p-5 md:p-6">
                <article className="flex flex-col gap-2">
                  <div className="flex flex-wrap items-center gap-2 text-small text-ash">
                    {n.pinned && <Badge tone="seal">{t('pinned')}</Badge>}
                    <Badge tone="clay">{category(n.category)}</Badge>
                    <time dateTime={n.publishedAt}>
                      {format.dateTime(new Date(n.publishedAt), 'long')}
                    </time>
                  </div>
                  <h2 className="text-h3">{n.title}</h2>
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

      {nextCursor && (
        <p className="mt-8">
          <Link
            href={{
              pathname: '/tin-tuc',
              query: { cursor: nextCursor, ...(householdSlug && { household: householdSlug }) },
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
