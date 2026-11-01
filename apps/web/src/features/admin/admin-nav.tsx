'use client';

import { cn } from '@vcraft/ui';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { Link, usePathname } from '@/i18n/navigation';
import { useAdminClient } from './admin-dashboard';

/** Số hồ sơ chờ trên menu tự làm mới; lỗi mạng thì giữ số cũ. */
const BADGE_REFRESH_MS = 60_000;

/** Điều hướng Admin: dọc ở màn rộng, hàng cuộn ngang ở màn hẹp. */
export function AdminNav() {
  const t = useTranslations('admin.nav');
  const pathname = usePathname();
  const { client } = useAdminClient();
  const [pending, setPending] = useState(0);

  useEffect(() => {
    if (!client) return;
    const refresh = () =>
      client
        .dashboard()
        .then((data) => setPending(data.pendingApplications))
        .catch(() => {});
    void refresh();
    const timer = window.setInterval(refresh, BADGE_REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [client]);

  const itemClass =
    'flex items-center gap-2 whitespace-nowrap rounded-input px-3 py-2 text-small transition-colors';
  const linkClass = (active: boolean) =>
    cn(
      itemClass,
      active ? 'bg-clay/12 font-medium text-clay-ink' : 'text-ink/80 hover:bg-ink/6 hover:text-ink',
    );
  const onQueue = pathname.startsWith('/admin/duyet-ho');
  const onCoordination = pathname.startsWith('/admin/dieu-phoi');
  const onAudit = pathname.startsWith('/admin/nhat-ky');
  const onNews = pathname.startsWith('/admin/tin-tuc');

  return (
    <nav aria-label={t('label')} className="overflow-x-auto lg:overflow-visible">
      <ul className="flex gap-1 lg:flex-col">
        <li>
          <Link
            href="/admin"
            aria-current={pathname === '/admin' ? 'page' : undefined}
            className={linkClass(pathname === '/admin')}
          >
            {t('overview')}
          </Link>
        </li>
        <li>
          <Link
            href="/admin/duyet-ho"
            aria-current={onQueue ? 'page' : undefined}
            className={linkClass(onQueue)}
          >
            {t('queue')}
            {pending > 0 ? (
              <span
                data-testid="pending-badge"
                className="rounded-chip bg-seal px-1.5 text-[0.7rem] text-paper"
              >
                <span aria-hidden="true">{pending}</span>
                <span className="sr-only">{t('pending', { count: pending })}</span>
              </span>
            ) : null}
          </Link>
        </li>
        <li>
          <Link
            href="/admin/dieu-phoi"
            aria-current={onCoordination ? 'page' : undefined}
            className={linkClass(onCoordination)}
          >
            {t('coordination')}
          </Link>
        </li>
        <li>
          <Link
            href="/admin/nhat-ky"
            aria-current={onAudit ? 'page' : undefined}
            className={linkClass(onAudit)}
          >
            {t('audit')}
          </Link>
        </li>
        <li>
          <Link
            href="/admin/tin-tuc"
            aria-current={onNews ? 'page' : undefined}
            className={linkClass(onNews)}
          >
            {t('news')}
          </Link>
        </li>
      </ul>
    </nav>
  );
}
