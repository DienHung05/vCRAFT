'use client';

import type { StudioClient } from '@vcraft/api-client';
import type { ProductScanStatsDto } from '@vcraft/contracts';
import { Card } from '@vcraft/ui';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

/** One labelled count per row, e.g. a country or a device class. */
function Breakdown({
  title,
  rows,
}: {
  title: string;
  rows: readonly { key: string; label: string; count: number }[];
}) {
  return (
    <div className="flex flex-col gap-1">
      <h3 className="text-small font-medium">{title}</h3>
      <ul className="flex flex-col gap-0.5 text-small text-ash">
        {rows.map((row) => (
          <li key={row.key} className="flex justify-between gap-4">
            <span>{row.label}</span>
            <span className="tabular-nums">{row.count}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** FR-TRC-06: how often the product's QR code was scanned, for the owning household. */
export function ScanStatsCard({
  productId,
  client,
}: {
  productId: string;
  client: Pick<StudioClient, 'getScanStats'>;
}) {
  const t = useTranslations('studio.products.scans');
  const locale = useLocale();
  const [stats, setStats] = useState<ProductScanStatsDto | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    client
      .getScanStats(productId)
      .then((s) => {
        if (!cancelled) setStats(s);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [client, productId]);

  const countryName = (code: string | null) => {
    if (!code) return t('unknown');
    try {
      return new Intl.DisplayNames([locale], { type: 'region' }).of(code) ?? code;
    } catch {
      return code;
    }
  };
  const peak = Math.max(1, ...(stats?.daily.map((d) => d.count) ?? []));

  return (
    <Card className="flex flex-col gap-4 p-5">
      <div>
        <h2 className="text-h3">{t('title')}</h2>
        <p className="text-small text-ash">{t('lead')}</p>
      </div>
      {failed ? <p className="text-small text-ash">{t('failed')}</p> : null}
      {stats ? (
        <>
          <dl className="flex flex-wrap gap-8">
            <div>
              <dt className="text-small text-ash">{t('total')}</dt>
              <dd className="text-h2 tabular-nums" data-testid="scan-total">
                {stats.total}
              </dd>
            </div>
            <div>
              <dt className="text-small text-ash">{t('last30Days')}</dt>
              <dd className="text-h2 tabular-nums" data-testid="scan-last30">
                {stats.last30Days}
              </dd>
            </div>
          </dl>
          {stats.last30Days === 0 ? (
            <p className="text-small text-ash">{t('empty')}</p>
          ) : (
            <>
              <div role="img" aria-label={t('chart')} className="flex h-16 items-end gap-0.5">
                {stats.daily.map((day) => (
                  <div
                    key={day.date}
                    title={`${day.date}: ${day.count}`}
                    className="min-h-px flex-1 rounded-t-sm bg-seal"
                    style={{ height: `${Math.max(2, (day.count / peak) * 100)}%` }}
                  />
                ))}
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Breakdown
                  title={t('countries')}
                  rows={stats.byCountry.map((r) => ({
                    key: r.country ?? '-',
                    label: countryName(r.country),
                    count: r.count,
                  }))}
                />
                <Breakdown
                  title={t('devices')}
                  rows={stats.byDeviceType.map((r) => ({
                    key: r.deviceType ?? '-',
                    label: t(`device.${r.deviceType ?? 'unknown'}`),
                    count: r.count,
                  }))}
                />
              </div>
            </>
          )}
        </>
      ) : null}
    </Card>
  );
}
