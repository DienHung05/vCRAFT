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
        router.replace(
          // Filters, sort and page survive the switch (GH#256); read at click time, so the header
          // needs no Suspense boundary for `useSearchParams`.
          // @ts-expect-error -- `params` luôn khớp `pathname` hiện tại, next-intl không suy được kiểu.
          {
            pathname,
            params,
            query: Object.fromEntries(new URLSearchParams(window.location.search)),
          },
          { locale: next },
        )
      }
      // The chip stays small; an invisible frame makes the tap target 44 px tall (WCAG 2.5.5, GH#257).
      className="relative rounded-chip px-3 py-1 text-small text-ash transition-colors after:absolute after:-inset-y-2 after:inset-x-0 after:content-[''] hover:bg-ink/6 hover:text-ink"
      // Tên truy cập phải chứa chữ đang hiển thị (WCAG 2.5.3), nên bắt đầu bằng `switchTo`.
      aria-label={`${t('switchTo')} – ${t('language')}`}
    >
      {t('switchTo')}
    </button>
  );
}
