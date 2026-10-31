'use client';

import { useTranslations } from 'next-intl';
import type { UploadItem } from './upload-queue';

/** Danh sách ảnh đang tải: tiến độ từng ảnh, hủy khi đang chạy, thử lại khi lỗi. */
export function UploadList<R>({
  items,
  onCancel,
  onRetry,
}: {
  items: readonly UploadItem<R>[];
  onCancel: (id: string) => void;
  onRetry: (id: string) => void;
}) {
  const t = useTranslations('media');
  const visible = items.filter((item) => item.status !== 'done' && item.status !== 'cancelled');
  if (visible.length === 0) return null;
  return (
    <ul className="flex flex-col gap-2" aria-label={t('uploads')}>
      {visible.map((item) => (
        <li key={item.id} className="rounded-input border border-ink/10 p-2 text-small">
          <div className="flex items-center justify-between gap-3">
            <span className="min-w-0 truncate">{item.name}</span>
            {item.status === 'failed' ? (
              <button
                type="button"
                className="shrink-0 text-clay underline underline-offset-4"
                onClick={() => onRetry(item.id)}
              >
                {t('retry')}
              </button>
            ) : (
              <button
                type="button"
                className="shrink-0 text-ash underline underline-offset-4"
                onClick={() => onCancel(item.id)}
              >
                {t('cancel')}
              </button>
            )}
          </div>
          {item.status === 'failed' ? (
            <p role="alert" className="mt-1 text-seal">
              {t('failed')}
            </p>
          ) : (
            <progress
              className="mt-1 h-1.5 w-full"
              max={100}
              value={item.status === 'uploading' ? item.progress : 0}
              aria-label={t(item.status === 'uploading' ? 'uploading' : 'preparing', {
                name: item.name,
              })}
            />
          )}
        </li>
      ))}
    </ul>
  );
}
