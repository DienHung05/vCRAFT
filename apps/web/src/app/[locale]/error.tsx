'use client';

import { Button } from '@vcraft/ui';
import { useTranslations } from 'next-intl';

/**
 * Lỗi chưa bắt trong một trang của `[locale]`, thường gặp nhất là API sập khi guard hỏi `GET /me`
 * (khác với "chưa đăng nhập"). Không lộ chi tiết kỹ thuật; cho thử lại.
 */
export default function LocaleError({ reset }: { error: Error; reset: () => void }) {
  const t = useTranslations('auth.serviceDown');
  return (
    <section
      role="alert"
      className="mx-auto flex max-w-prose-vn flex-col items-center gap-5 px-gutter py-section text-center"
    >
      <h1>{t('title')}</h1>
      <p className="text-ash">{t('lead')}</p>
      <Button type="button" onClick={reset}>
        {t('retry')}
      </Button>
    </section>
  );
}
