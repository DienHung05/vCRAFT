'use client';

import { cn } from '@vcraft/ui';
import { useTranslations } from 'next-intl';
import { Link, usePathname } from '@/i18n/navigation';

export interface AdminNavProps {
  /** Mã điều phối mẫu mà mục "Điều phối" dẫn tới tới khi có trang danh sách. */
  coordinationCode: string;
}

const ITEMS = ['queue', 'coordination', 'news', 'audit'] as const;

/**
 * Điều hướng Admin: dọc ở màn rộng, hàng cuộn ngang ở màn hẹp. Hiện mới có màn Điều phối;
 * các mục còn lại hiển thị nhưng chưa bấm được (`aria-disabled`).
 */
export function AdminNav({ coordinationCode }: AdminNavProps) {
  const t = useTranslations('admin.nav');
  const pathname = usePathname();
  const onCoordination = pathname.startsWith('/admin/dieu-phoi');

  const itemClass =
    'flex items-center gap-2 whitespace-nowrap rounded-input px-3 py-2 text-small transition-colors duration-(--duration-quick)';

  return (
    <nav aria-label={t('label')} className="overflow-x-auto lg:overflow-visible">
      <ul className="flex gap-1 lg:flex-col">
        {ITEMS.map((key) =>
          key === 'coordination' ? (
            <li key={key}>
              <Link
                href={{ pathname: '/admin/dieu-phoi/[code]', params: { code: coordinationCode } }}
                aria-current={onCoordination ? 'page' : undefined}
                className={cn(
                  itemClass,
                  onCoordination
                    ? 'bg-clay/12 font-medium text-clay'
                    : 'text-ink/80 hover:bg-ink/6 hover:text-ink',
                )}
              >
                {t(key)}
              </Link>
            </li>
          ) : (
            <li key={key}>
              <span aria-disabled="true" className={cn(itemClass, 'text-ash/70')}>
                {t(key)}
                <span className="rounded-chip bg-ink/6 px-1.5 text-[0.7rem]">{t('soon')}</span>
              </span>
            </li>
          ),
        )}
      </ul>
    </nav>
  );
}
