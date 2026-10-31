import { useTranslations } from 'next-intl';
import { RetryLink } from './retry-link';

/** Khối báo lỗi tải dữ liệu từ API, kèm nút thử lại (phân biệt với 404 thật). */
export function DataUnavailable({ className }: { className?: string }) {
  const t = useTranslations('common');
  return (
    <div
      role="alert"
      className={
        className ?? 'mx-auto flex max-w-editorial flex-col items-start gap-3 px-gutter py-section'
      }
    >
      <p className="text-ash">{t('dataUnavailable')}</p>
      <RetryLink />
    </div>
  );
}
