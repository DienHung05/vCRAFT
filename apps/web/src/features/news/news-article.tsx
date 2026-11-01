import type { NewsDetailDto } from '@vcraft/contracts';
import { Badge } from '@vcraft/ui';
import { useFormatter, useLocale, useTranslations } from 'next-intl';
import { Breadcrumbs } from '@/components/breadcrumbs';
import { ImageSlot } from '@/components/image-slot';
import { PhotoCredit } from '@/components/photo-credit';
import { altFor, photoFromUrl, slotPhoto, tintOf } from '@/features/catalog/view-models';
import { Link } from '@/i18n/navigation';

/** Full article: cover, category, body and related news (FR-NEWS-01). */
export function NewsArticleView({ article }: { article: NewsDetailDto }) {
  const t = useTranslations('indexPages.news');
  const category = useTranslations('indexPages.news.categories');
  const common = useTranslations('common');
  const format = useFormatter();
  const locale = useLocale();
  return (
    <article className="mx-auto flex max-w-prose-vn flex-col gap-6 px-gutter pt-12 pb-section">
      <Breadcrumbs
        items={[
          { label: common('home'), href: '/' },
          { label: t('allNews'), href: '/tin-tuc' },
          { label: article.title },
        ]}
      />
      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2 text-small text-ash">
          {article.pinned ? <Badge tone="seal">{t('pinned')}</Badge> : null}
          <Badge tone="clay">{category(article.category)}</Badge>
          {article.visibility === 'VILLAGE' ? (
            <Badge tone="outline">{t('villageOnly')}</Badge>
          ) : null}
          <time dateTime={article.publishedAt}>
            {format.dateTime(new Date(article.publishedAt), 'long')}
          </time>
        </div>
        <h1 className="text-h1 break-words">{article.title}</h1>
        <p className="text-ash">{article.summary}</p>
        <p className="text-small text-ash">
          {article.householdName ? t('byHousehold', { name: article.householdName }) : t('village')}
        </p>
      </header>
      {article.cover ? (
        <div>
          <ImageSlot
            alt={altFor(locale, article.cover.alt || article.title, article.cover.altEn)}
            tint={tintOf(article.slug)}
            ratio="3/2"
            {...slotPhoto(
              photoFromUrl(
                article.cover.url,
                altFor(locale, article.cover.alt || article.title, article.cover.altEn),
                article.cover.variants,
              ),
            )}
            sizes="(min-width: 768px) 40rem, 100vw"
          />
          <PhotoCredit credit={article.cover.credit} />
        </div>
      ) : null}
      {article.bodyHtml ? (
        <div
          data-testid="news-body"
          className="flex flex-col gap-4 break-words [&_a]:text-clay [&_a]:underline [&_blockquote]:border-clay/40 [&_blockquote]:border-l-2 [&_blockquote]:pl-4 [&_h2]:text-h2 [&_h3]:text-h3 [&_ol]:list-decimal [&_ol]:pl-6 [&_ul]:list-disc [&_ul]:pl-6"
          // biome-ignore lint/security/noDangerouslySetInnerHtml: `bodyHtml` is sanitized by the API on every write, and no other path stores it.
          dangerouslySetInnerHTML={{ __html: article.bodyHtml }}
        />
      ) : (
        <p data-testid="news-body" className="break-words whitespace-pre-line">
          {article.body}
        </p>
      )}
      {article.related.length > 0 ? (
        <section aria-labelledby="related-news" className="mt-6 flex flex-col gap-3">
          <h2 id="related-news" className="text-h3">
            {t('related')}
          </h2>
          <ul className="flex flex-col gap-2">
            {article.related.map((item) => (
              <li key={item.slug}>
                <Link
                  href={{ pathname: '/tin-tuc/[slug]', params: { slug: item.slug } }}
                  className="text-clay underline underline-offset-4"
                >
                  {item.title}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </article>
  );
}
