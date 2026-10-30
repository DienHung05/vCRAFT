'use client';

import { useParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { usePathname, useRouter } from '@/i18n/navigation';

/** Đổi vi ⇄ en, giữ nguyên trang đang xem (pathnames bản địa hóa tự đổi URL). */
export function LocaleSwitcher() {
  const t = useTranslations('nav');
  const locale = useLocale();
  const pathname = usePathname();
  const params = useParams();
  const router = useRouter();
  const next = locale === 'vi' ? 'en' : 'vi';

  return (
    <button
      type="button"
      lang={next}
      onClick={() =>
        // @ts-expect-error -- `params` luôn khớp `pathname` hiện tại, next-intl không suy được kiểu.
        router.replace({ pathname, params }, { locale: next })
      }
      className="rounded-chip px-3 py-1 text-small text-ash transition-colors hover:bg-ink/6 hover:text-ink"
      // Tên truy cập phải chứa chữ đang hiển thị (WCAG 2.5.3), nên bắt đầu bằng `switchTo`.
      aria-label={`${t('switchTo')} – ${t('language')}`}
    >
      {t('switchTo')}
    </button>
  );
}
