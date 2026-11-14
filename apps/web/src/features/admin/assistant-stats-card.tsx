'use client';

import type { AdminClient } from '@vcraft/api-client';
import type { AssistantStatsDto } from '@vcraft/contracts';
import { Card } from '@vcraft/ui';
import { useFormatter, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

const DAYS = 7;

/**
 * The Fox assistant on the admin dashboard (FR-AST-08, GH#82): turns and block rate over the last week,
 * thumbs up/down and first-token latency. Loads on its own so the main figures never wait for it.
 */
export function AssistantStatsCard({ client }: { client: AdminClient }) {
  const t = useTranslations('admin.dashboard.assistant');
  const format = useFormatter();
  const [stats, setStats] = useState<AssistantStatsDto | null | 'error'>(null);

  useEffect(() => {
    let live = true;
    // Through a promise, so a client that cannot fetch the figures at all also lands in the error state.
    Promise.resolve()
      .then(() => client.assistantStats(DAYS))
      .then((data) => live && setStats(data))
      .catch(() => live && setStats('error'));
    return () => {
      live = false;
    };
  }, [client]);

  const ms = (value: number | null) => (value === null ? '—' : t('ms', { value }));

  return (
    <Card className="flex flex-col gap-4 p-4 md:p-6" aria-labelledby="assistant-stats-title">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="assistant-stats-title" className="font-display text-h3">
          {t('title')}
        </h2>
        <p className="text-small text-ash">{t('period', { days: DAYS })}</p>
      </div>
      {stats === null ? <p className="text-small text-ash">{t('loading')}</p> : null}
      {stats === 'error' ? <p className="text-small text-ash">{t('failed')}</p> : null}
      {stats && stats !== 'error' ? (
        <>
          <dl className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <div>
              <dt className="text-small text-ash">{t('turns')}</dt>
              <dd className="font-display text-h2">{format.number(stats.turns)}</dd>
            </div>
            <div>
              <dt className="text-small text-ash">{t('blockRate')}</dt>
              <dd className="font-display text-h2">
                {format.number(stats.blockRate, { style: 'percent', maximumFractionDigits: 1 })}
              </dd>
            </div>
            <div>
              <dt className="text-small text-ash">{t('feedback')}</dt>
              <dd className="font-display text-h2">
                {t('feedbackValue', { up: stats.feedback.up, down: stats.feedback.down })}
              </dd>
            </div>
            <div>
              <dt className="text-small text-ash">{t('latency')}</dt>
              <dd className="font-display text-h2">
                {t('latencyValue', {
                  p50: ms(stats.firstTokenMs.p50),
                  p95: ms(stats.firstTokenMs.p95),
                })}
              </dd>
            </div>
          </dl>
          <dl className="grid grid-cols-2 gap-4 md:grid-cols-3">
            <div>
              <dt className="text-small text-ash">{t('limited')}</dt>
              <dd className="font-display text-h3">{format.number(stats.limited)}</dd>
            </div>
            <div>
              <dt className="text-small text-ash">{t('disabled')}</dt>
              <dd className="font-display text-h3">{format.number(stats.disabled)}</dd>
            </div>
            <div>
              <dt className="text-small text-ash">{t('failures')}</dt>
              <dd className="font-display text-h3">{format.number(stats.failures)}</dd>
            </div>
          </dl>
        </>
      ) : null}
    </Card>
  );
}
