'use client';

import { createVillageNewsClient, type VillageNewsClient } from '@vcraft/api-client';
import type { TodayOutagesDto } from '@vcraft/contracts';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { Link } from '@/i18n/navigation';
import { useLiveClient } from '@/lib/api/live-session';

/**
 * Banner across Studio on a day with a planned power cut in the village (PLAN E11), so a household does
 * not start an electric firing that will be cut off. Nothing shows on other days or if the request fails.
 */
export function OutageBanner({ client: provided }: { client?: VillageNewsClient }) {
  const t = useTranslations('studio.outage');
  const { client } = useLiveClient(provided, (getAccessToken) =>
    createVillageNewsClient({ getAccessToken }),
  );
  const [today, setToday] = useState<TodayOutagesDto | null>(null);

  useEffect(() => {
    client
      ?.todayOutages()
      .then(setToday)
      .catch(() => setToday(null));
  }, [client]);

  if (!today || today.outages.length === 0) return null;
  const [first] = today.outages;
  return (
    <div role="status" className="border-lacquer/30 border-b bg-lacquer/14 text-ink">
      <div className="mx-auto flex max-w-editorial flex-wrap items-center gap-x-3 gap-y-1 px-gutter py-2 text-small">
        <strong className="font-semibold">{t('title')}</strong>
        <span>
          {today.outages
            .map((o) => t('slot', { from: o.from, to: o.to, area: o.area }))
            .join(' · ')}
        </span>
        {first ? (
          <Link
            href={{ pathname: '/tin-tuc/[slug]', params: { slug: first.newsSlug } }}
            className="underline underline-offset-4"
          >
            {t('details')}
          </Link>
        ) : null}
      </div>
    </div>
  );
}
