'use client';

import type { AdminClient } from '@vcraft/api-client';
import type { CoordinationQueueItemDto } from '@vcraft/contracts';
import { Badge, Button, Card } from '@vcraft/ui';
import { useFormatter, useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';
import { Link } from '@/i18n/navigation';
import { useAdminClient } from './admin-dashboard';

const REFRESH_MS = 30_000;

/** Queue of requests that need coordination (FR-ORD-01, 02). Claiming is one admin per request. */
export function CoordinationQueue({ client: provided }: { client?: AdminClient }) {
  const t = useTranslations('admin.coordinationQueue');
  const statuses = useTranslations('rfq.status');
  const format = useFormatter();
  const { client, loading } = useAdminClient(provided);
  const [rows, setRows] = useState<readonly CoordinationQueueItemDto[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [claiming, setClaiming] = useState<string | null>(null);
  const [claimFailed, setClaimFailed] = useState(false);

  const load = useCallback(async () => {
    if (!client) return;
    try {
      setRows(await client.coordinationQueue());
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, [client]);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => {
      if (!document.hidden) void load();
    }, REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [load]);

  if (!loading && !client) return <p>{t('signIn')}</p>;

  const claim = async (row: CoordinationQueueItemDto) => {
    if (!client || claiming) return;
    setClaiming(row.id);
    setClaimFailed(false);
    try {
      await client.claimCoordination(row.id, row.version);
    } catch {
      setClaimFailed(true);
    } finally {
      setClaiming(null);
      await load();
    }
  };

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-h2">{t('title')}</h1>
        <p className="text-ash">{t('lead')}</p>
      </header>
      {claimFailed ? <p role="alert">{t('claimFailed')}</p> : null}
      {failed ? (
        <div role="alert" className="flex flex-col items-start gap-3">
          <p>{t('failed')}</p>
          <Button type="button" variant="secondary" onClick={() => void load()}>
            {t('retry')}
          </Button>
        </div>
      ) : rows === null ? (
        <p role="status">{t('loading')}</p>
      ) : rows.length === 0 ? (
        <p className="text-ash">{t('empty')}</p>
      ) : (
        <ul className="flex flex-col gap-3" data-testid="coordination-queue">
          {rows.map((row) => (
            <li key={row.id}>
              <Card className="flex flex-wrap items-center justify-between gap-4 p-4">
                <div className="flex min-w-0 flex-1 basis-64 flex-col gap-2">
                  <p className="font-medium break-words">{row.design}</p>
                  <dl className="flex flex-wrap gap-x-6 gap-y-1 text-small">
                    <div className="flex gap-2">
                      <dt className="text-ash">{t('buyer')}</dt>
                      <dd>{row.buyerName}</dd>
                    </div>
                    <div className="flex gap-2">
                      <dt className="text-ash">{t('quantity')}</dt>
                      <dd>
                        {format.number(row.quantity)} {row.unit}
                      </dd>
                    </div>
                    <div className="flex gap-2">
                      <dt className="text-ash">{t('deadline')}</dt>
                      <dd>
                        <time dateTime={row.biddingClosesAt}>
                          {format.dateTime(new Date(row.biddingClosesAt), 'short')}
                        </time>
                      </dd>
                    </div>
                    <div className="flex gap-2">
                      <dt className="text-ash">{t('requiredBy')}</dt>
                      <dd>
                        <time dateTime={row.requiredBy}>
                          {format.dateTime(new Date(row.requiredBy), 'short')}
                        </time>
                      </dd>
                    </div>
                  </dl>
                  <p className="flex flex-wrap items-center gap-2 text-small text-ash">
                    <Badge tone="outline">{statuses(row.status)}</Badge>
                    <span>{t('offers', { count: row.contributionCount })}</span>
                  </p>
                </div>
                <div className="flex flex-col items-start gap-2 text-small">
                  {row.claimedByMe ? (
                    <>
                      <span>{t('mine')}</span>
                      <Link
                        href={{ pathname: '/admin/dieu-phoi/[code]', params: { code: row.id } }}
                        className="font-medium text-clay hover:underline"
                      >
                        {t('open')}
                      </Link>
                    </>
                  ) : row.claimed ? (
                    <span className="text-ash">
                      {row.coordinatorName
                        ? t('claimedBy', { name: row.coordinatorName })
                        : t('claimedByOther')}
                    </span>
                  ) : (
                    <>
                      <span className="text-ash">{t('unclaimed')}</span>
                      <Button
                        type="button"
                        disabled={claiming !== null}
                        onClick={() => void claim(row)}
                      >
                        {t(claiming === row.id ? 'claiming' : 'claim')}
                      </Button>
                    </>
                  )}
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
