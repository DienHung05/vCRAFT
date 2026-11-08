'use client';

import type { OpeningIntervalDto } from '@vcraft/contracts';
import { workshopOpenState } from '@vcraft/domain';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

/** Monday first, Sunday last; the numbers are the weekday indexes of `OpeningIntervalDto.day`. */
const WEEK = [1, 2, 3, 4, 5, 6, 0] as const;

export interface WorkshopHoursFacts {
  openingHours?: readonly OpeningIntervalDto[];
  temporarilyClosed?: boolean;
  closureReason?: string;
}

/**
 * Open-now status of a workshop (FR-ART-05, BR-03) in Vietnam time. The clock is read after hydration
 * so the server HTML and the first browser render agree, then refreshed every minute.
 */
export function WorkshopOpenStatus({ workshop }: { workshop: WorkshopHoursFacts }) {
  const t = useTranslations('exhibition');
  const map = useTranslations('villageMap');
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  if (workshop.temporarilyClosed) {
    return (
      <p className="mt-3 text-small font-medium text-seal" data-testid="workshop-status">
        {workshop.closureReason
          ? map('temporarilyClosedReason', { reason: workshop.closureReason })
          : map('temporarilyClosed')}
      </p>
    );
  }
  if (!workshop.openingHours?.length) {
    return (
      <p className="mt-3 text-small text-ash" data-testid="workshop-status">
        {map('noHours')}
      </p>
    );
  }
  if (!now) return null;
  const state = workshopOpenState(workshop, now);
  if (state.open) {
    return (
      <p className="mt-3 text-small font-medium text-glaze" data-testid="workshop-status">
        {map('openNow')}
      </p>
    );
  }
  return (
    <p className="mt-3 text-small text-ash" data-testid="workshop-status">
      <span className="font-medium">{t('closedNow')}</span>
      {state.reopens
        ? ` · ${t('reopensAt', {
            time: state.reopens.at,
            day: map(`days.${state.reopens.day}` as 'days.0'),
          })}`
        : null}
    </p>
  );
}

/** The weekly opening hours as a readable list, Monday first; days without an interval read as closed. */
export function WeeklyHours({ hours }: { hours: readonly OpeningIntervalDto[] }) {
  const t = useTranslations('exhibition');
  const map = useTranslations('villageMap');
  return (
    <div className="mt-3">
      <p className="text-small font-medium">{t('weeklyHours')}</p>
      <ul className="mt-1 space-y-0.5 text-small" data-testid="weekly-hours">
        {WEEK.map((day) => {
          const intervals = hours.filter((h) => h.day === day);
          return (
            <li key={day} className="flex justify-between gap-4">
              <span>{map(`days.${day}` as 'days.0')}</span>
              <span className={intervals.length > 0 ? '' : 'text-ash'}>
                {intervals.length > 0
                  ? intervals.map((h) => `${h.open} – ${h.close}`).join(', ')
                  : t('dayClosed')}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
