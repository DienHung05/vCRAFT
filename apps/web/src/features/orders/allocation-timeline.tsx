'use client';

import type { AllocationScheduleDto } from '@vcraft/contracts';
import { liveShares } from '@vcraft/domain';
import { Badge } from '@vcraft/ui';
import { useFormatter, useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

type Share = AllocationScheduleDto[number]['allocations'][number];
const TONE = { DONE: 'neutral', ON_TRACK: 'celadon', BEHIND: 'lacquer', OVERDUE: 'seal' } as const;

/** A timeline of the caller's authorized shares. The list states everything drawn by the bars. */
export function AllocationTimeline({
  shares,
  unit,
  renderAction,
}: {
  shares: readonly Share[];
  unit: string;
  renderAction?: (share: Share) => ReactNode;
}) {
  const t = useTranslations('orderProgress');
  const status = useTranslations('order.allocation');
  const format = useFormatter();
  const effective = liveShares(shares);
  const total = effective.reduce((sum, share) => sum + share.quantity, 0);
  const completed = effective.reduce((sum, share) => sum + share.completedQty, 0);
  const percent = total === 0 ? 0 : Math.min(100, Math.round((completed / total) * 100));
  if (shares.length === 0) return <p className="text-small text-ash">{t('empty')}</p>;
  const now = Date.now();
  const from = Math.min(...shares.map((share) => new Date(share.startedAt).getTime()));
  const to = Math.max(now, ...shares.map((share) => new Date(share.dueAt).getTime()));
  const at = (date: string | number) =>
    `${Math.min(100, Math.max(0, ((new Date(date).getTime() - from) / Math.max(1, to - from)) * 100))}%`;
  const day = (date: string | number) => format.dateTime(new Date(date), 'short');
  return (
    <div className="flex min-w-0 flex-col gap-3">
      <p className="text-small font-medium">{t('percent', { percent: format.number(percent) })}</p>
      <progress
        aria-label={t('label')}
        value={percent}
        max={100}
        className="h-2 w-full accent-clay"
      />
      <p className="text-small text-ash">
        {t('completed', { done: format.number(completed), total: format.number(total), unit })}
      </p>
      <div aria-hidden="true" className="flex justify-between text-small text-ash">
        <span>{day(from)}</span>
        <span>{day(to)}</span>
      </div>
      <ul className="flex min-w-0 flex-col gap-4">
        {shares.map((share) => (
          <li key={share.id} className="flex min-w-0 flex-col gap-2">
            <div className="flex flex-wrap items-center justify-between gap-2 text-small">
              <span className="break-words font-medium">{share.householdName}</span>
              {share.status === 'IN_PROGRESS' || share.status === 'DONE' ? (
                <Badge tone={TONE[share.lateness]}>{t(`lateness.${share.lateness}`)}</Badge>
              ) : (
                <Badge>{status(share.status)}</Badge>
              )}
            </div>
            <p className="text-small text-ash">
              {t('counts', {
                done: format.number(share.completedQty),
                total: format.number(share.quantity),
                unit,
                due: day(share.dueAt),
              })}
              {share.completedQty < share.quantity
                ? ` · ${t('expected', { expected: format.number(share.expectedQty), unit })}`
                : null}
            </p>
            <p className="text-small text-ash">
              {t('started')} <time dateTime={share.startedAt}>{day(share.startedAt)}</time>
            </p>
            <div aria-hidden="true" className="relative h-3 rounded-chip bg-ink/6">
              <div
                className="absolute inset-y-0 rounded-chip bg-ink/12"
                style={{ left: at(share.startedAt), right: `calc(100% - ${at(share.dueAt)})` }}
              >
                <div
                  className="h-full rounded-chip bg-clay"
                  style={{
                    width: `${Math.min(100, (share.completedQty / Math.max(1, share.quantity)) * 100)}%`,
                  }}
                />
              </div>
              <div className="absolute -inset-y-1 w-px bg-glaze" style={{ left: at(now) }} />
            </div>
            {renderAction?.(share)}
          </li>
        ))}
      </ul>
    </div>
  );
}
