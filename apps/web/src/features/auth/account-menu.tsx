'use client';

import { Badge, buttonVariants, cn } from '@vcraft/ui';
import { usePathname } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { Link } from '@/i18n/navigation';
import { workspacePath } from '@/lib/auth/access';
import { hasUnfinishedHouseholdRegistration } from '@/lib/auth/household-intent';
import { clearRememberPreference } from '@/lib/auth/remember';
import { useAccount } from '@/lib/auth/use-account';

/**
 * Chỗ đăng nhập trong header: khách thấy liên kết Đăng nhập / Đăng ký; người đã đăng nhập thấy thẻ
 * tài khoản với email, vai trò (theo CSDL vCraft) và nút đăng xuất. Dùng được ở mọi khung (header
 * công khai, thanh bên Admin). `align` quyết định menu xổ về phía nào.
 */
export function AccountMenu({
  align = 'end',
  compact = false,
}: {
  align?: 'start' | 'end';
  /** Show only the avatar until 2xl: the crowded public header has no room for the email. */
  compact?: boolean;
}) {
  const t = useTranslations('auth');
  const locale = useLocale();
  const account = useAccount();
  const menu = useRef<HTMLDetailsElement>(null);
  const pathname = usePathname();
  const closeMenu = () => {
    if (menu.current) menu.current.open = false;
  };

  // Close after a client-side navigation: the header stays mounted across pages.
  // biome-ignore lint/correctness/useExhaustiveDependencies: `pathname` is the trigger, not a value read here.
  useEffect(() => {
    if (menu.current) menu.current.open = false;
  }, [pathname]);
  const [signingOut, setSigningOut] = useState(false);

  // Đóng menu khi bấm ra ngoài hoặc nhấn Escape.
  useEffect(() => {
    const close = (event: Event) => {
      const el = menu.current;
      if (!el?.open) return;
      if (event instanceof KeyboardEvent) {
        if (event.key !== 'Escape') return;
        el.open = false;
        el.querySelector('summary')?.focus();
        return;
      }
      if (
        event instanceof MouseEvent &&
        event.target instanceof Node &&
        el.contains(event.target)
      ) {
        return;
      }
      el.open = false;
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', close);
    };
  }, []);

  if (account.status === 'loading') {
    // Giữ chỗ để header không nhảy khi biết trạng thái.
    return <span role="status" aria-label={t('nav.checking')} className="block h-9 w-20" />;
  }

  if (account.status === 'guest') {
    return (
      <div className="flex items-center gap-1">
        <Link href="/dang-nhap" className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
          {t('nav.signIn')}
        </Link>
        <Link
          href="/dang-ky"
          className={cn(buttonVariants({ size: 'sm' }), 'hidden sm:inline-flex')}
        >
          {t('nav.register')}
        </Link>
      </div>
    );
  }

  const { email, me } = account;
  const unfinishedHousehold = hasUnfinishedHouseholdRegistration(me, account.householdIntent);
  const initial = (email.trim()[0] ?? '?').toUpperCase();

  const signOut = async () => {
    setSigningOut(true);
    try {
      // Loaded on demand: the Supabase SDK is only needed once the visitor is signed in and leaves.
      const { browserSupabase } = await import('@/lib/auth/supabase-browser');
      await browserSupabase()?.auth.signOut();
      clearRememberPreference();
    } finally {
      // Tải lại toàn trang để Server Component bỏ phiên cũ.
      window.location.assign(`/${locale}`);
    }
  };

  return (
    <details ref={menu} className="group relative">
      <summary className="flex h-9 cursor-pointer list-none items-center gap-2 rounded-input pr-2 pl-1 text-small text-ink hover:bg-ink/6 focus-visible:outline-2 focus-visible:outline-glaze [&::-webkit-details-marker]:hidden">
        <span
          aria-hidden="true"
          className="grid size-7 place-items-center rounded-full bg-glaze font-medium text-paper"
        >
          {initial}
        </span>
        {/* The name comes from the content, so the visible email is always part of it (WCAG 2.5.3). */}
        {/* `not-sr-only` resets overflow and white-space, so the truncation lives on the inner span. */}
        <span
          className={cn(
            'min-w-0 max-w-36',
            compact ? 'sr-only 2xl:not-sr-only' : 'sr-only md:not-sr-only',
          )}
        >
          <span className="block truncate" title={email}>
            <span className="sr-only">{t('nav.account')}: </span>
            {email}
          </span>
        </span>
      </summary>
      <div
        className={cn(
          'absolute z-50 mt-2 w-72 rounded-card bg-surface p-4 shadow-warm ring-1 ring-ink/8',
          align === 'end' ? 'right-0' : 'left-0',
        )}
      >
        <p className="truncate text-small font-medium text-ink" title={email}>
          {email}
        </p>
        {me ? (
          <p className="mt-2 flex items-center gap-2 text-small text-ash">
            {t('nav.roleLabel')}
            <Badge tone="glaze">{t(`roles.${me.role}`)}</Badge>
          </p>
        ) : null}
        {me?.household?.status === 'PENDING_REVIEW' ? (
          <p className="mt-2 text-small text-ash">{t('nav.householdPending')}</p>
        ) : null}
        {unfinishedHousehold ? (
          <Link
            href="/dang-ky-nghe-nhan"
            onClick={closeMenu}
            className="mt-3 block rounded-input bg-glaze/8 px-2 py-2 text-small font-medium text-clay hover:bg-ink/6"
          >
            {t('nav.finishHousehold')}
          </Link>
        ) : null}
        {me ? (
          <Link
            href={workspacePath(me.role)}
            onClick={closeMenu}
            className="mt-3 block rounded-input px-2 py-2 text-small text-clay hover:bg-ink/6"
          >
            {t(`areas.${me.role}`)}
          </Link>
        ) : null}
        <Link
          href="/yeu-thich"
          onClick={() => {
            if (menu.current) menu.current.open = false;
          }}
          className="block rounded-input px-2 py-2 text-small text-clay hover:bg-ink/6"
        >
          {t('nav.favourites')}
        </Link>
        <Link
          href="/tai-khoan"
          onClick={() => {
            if (menu.current) menu.current.open = false;
          }}
          className="block rounded-input px-2 py-2 text-small text-clay hover:bg-ink/6"
        >
          {t('nav.settings')}
        </Link>
        <button
          type="button"
          onClick={signOut}
          disabled={signingOut}
          className={cn(buttonVariants({ variant: 'secondary', size: 'sm' }), 'mt-3 w-full')}
        >
          {signingOut ? t('nav.signingOut') : t('nav.signOut')}
        </button>
      </div>
    </details>
  );
}
