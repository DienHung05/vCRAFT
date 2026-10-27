'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * "Còn N ngày" tới hạn chào giá. Tính sau khi hydrate (trang được dựng sẵn tĩnh, giờ lúc build
 * sẽ cũ), nên lúc đầu chưa hiện gì để tránh lệch giữa server và client.
 */
export function DeadlineCountdown({ until }: { until: string }) {
  const t = useTranslations('rfq.summary');
  const [days, setDays] = useState<number | null>(null);

  useEffect(() => {
    setDays(Math.ceil((new Date(until).getTime() - Date.now()) / DAY_MS));
  }, [until]);

  if (days === null) return null;
  return <span className="text-clay">{days > 0 ? t('daysLeft', { days }) : t('closed')}</span>;
}
