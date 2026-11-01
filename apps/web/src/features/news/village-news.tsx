'use client';

import { createVillageNewsClient, type VillageNewsClient } from '@vcraft/api-client';
import type { NewsDetailDto, NewsSummaryDto } from '@vcraft/contracts';
import { buttonVariants } from '@vcraft/ui';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { EmptyState } from '@/components/states/empty-state';
import { ArticleSkeleton } from '@/components/states/skeletons';
import { Link } from '@/i18n/navigation';
import { useLiveClient } from '@/lib/api/live-session';
import { NewsArticleView } from './news-article';

const useVillageClient = (provided?: VillageNewsClient) =>
  useLiveClient(provided, (getAccessToken) => createVillageNewsClient({ getAccessToken }));

/** Village-only items above the public list. Everyone else sees nothing here. */
export function VillageNews({ client: provided }: { client?: VillageNewsClient }) {
  const t = useTranslations('indexPages.news');
  const { client } = useVillageClient(provided);
  const [items, setItems] = useState<readonly NewsSummaryDto[]>([]);

  useEffect(() => {
    client
      ?.list()
      .then((page) => setItems(page.data))
      .catch(() => setItems([]));
  }, [client]);

  if (items.length === 0) return null;
  return (
    <section
      aria-labelledby="village-news"
      className="mx-auto flex max-w-editorial flex-col gap-3 px-gutter pt-8"
    >
      <h2 id="village-news" className="text-h3">
        {t('villageTitle')}
      </h2>
      <ul className="flex flex-col gap-2">
        {items.map((item) => (
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
  );
}

/** The public API said 404: this may be a village-only item the signed-in user is allowed to read. */
export function VillageArticle({
  slug,
  client: provided,
}: {
  slug: string;
  client?: VillageNewsClient;
}) {
  const t = useTranslations('indexPages.news');
  const { client, loading } = useVillageClient(provided);
  const [article, setArticle] = useState<NewsDetailDto | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'not-found'>('loading');

  useEffect(() => {
    if (loading) return;
    if (!client) {
      setState('not-found');
      return;
    }
    client
      .get(slug)
      .then((found) => {
        setArticle(found);
        setState('ready');
      })
      .catch(() => setState('not-found'));
  }, [client, loading, slug]);

  if (state === 'ready' && article) return <NewsArticleView article={article} />;
  if (state === 'loading') return <ArticleSkeleton label={t('loading')} />;
  return (
    <EmptyState
      className="px-gutter py-section"
      illustration="scroll"
      title={t('notFound')}
      action={
        <Link href="/tin-tuc" className={buttonVariants({ variant: 'secondary' })}>
          {t('allNews')}
        </Link>
      }
    />
  );
}
