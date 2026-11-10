'use client';

import { Button, type ButtonProps } from '@vcraft/ui';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { getPathname } from '@/i18n/navigation';
import { clearSignedInBrowserData } from '@/lib/auth/signed-out-cleanup';

/** Đăng xuất rồi tới trang đăng nhập (dùng ở trang 403: "đăng nhập tài khoản khác"). */
export function SignOutToSignInButton({
  children,
  ...props
}: Omit<ButtonProps, 'onClick' | 'type'>) {
  const t = useTranslations('auth.nav');
  const locale = useLocale();
  const [busy, setBusy] = useState(false);

  const run = async () => {
    setBusy(true);
    try {
      // Imported on click: this button is referenced by forbidden.tsx, so a static import would put the
      // Supabase SDK on the initial load of every page.
      const { browserSupabase } = await import('@/lib/auth/supabase-browser');
      await browserSupabase()?.auth.signOut();
      clearSignedInBrowserData();
    } finally {
      // Tải lại toàn trang để Server Component bỏ phiên cũ.
      window.location.assign(getPathname({ href: '/dang-nhap', locale: locale as 'vi' | 'en' }));
    }
  };

  return (
    <Button type="button" onClick={run} disabled={busy} {...props}>
      {busy ? t('signingOut') : children}
    </Button>
  );
}
