'use client';

import { Button } from '@vcraft/ui';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';

/** Nút "Thử lại" cho khối dữ liệu dựng phía server: tải lại dữ liệu trang, không tải lại cả trang. */
export function RetryLink() {
  const t = useTranslations('common');
  const router = useRouter();
  return (
    <Button type="button" variant="secondary" onClick={() => router.refresh()}>
      {t('retry')}
    </Button>
  );
}
