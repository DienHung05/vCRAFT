import { buttonVariants, VaseFigure } from '@vcraft/ui';
import { getTranslations } from 'next-intl/server';
import { PublicShell } from '@/components/shell/public-shell';
import { SignOutToSignInButton } from '@/features/auth/sign-out-button';
import { Link } from '@/i18n/navigation';
import { getViewer } from '@/lib/auth/viewer';

/**
 * Trang 403 của khu vực theo vai trò (Buyer, Studio, Admin), hiện khi `requireArea` gọi `forbidden()`.
 * Nói rõ đang đăng nhập bằng tài khoản nào, vai trò gì, hoặc tài khoản đang bị khóa, để người dùng
 * biết đổi tài khoản thay vì tưởng trang hỏng.
 */
export default async function Forbidden() {
  const t = await getTranslations('auth');
  // `cache` đã có sẵn kết quả từ guard trong cùng request; API sập thì vẫn hiện trang 403 chung.
  const viewer = await getViewer().catch(() => null);

  return (
    <PublicShell>
      <section className="mx-auto flex max-w-prose-vn flex-col items-center gap-5 px-gutter py-section text-center">
        <VaseFigure className="h-28 opacity-80" body="var(--color-ash)" />
        <h1>{t('forbidden.title')}</h1>
        {viewer ? (
          <p className="text-small text-ash">
            {t('forbidden.signedInAs', { email: viewer.email, role: t(`roles.${viewer.role}`) })}
          </p>
        ) : null}
        <p className="text-ash">
          {viewer?.status === 'LOCKED' ? t('forbidden.locked') : t('forbidden.lead')}
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link href="/" className={buttonVariants()}>
            {t('forbidden.home')}
          </Link>
          <SignOutToSignInButton variant="secondary">{t('forbidden.switch')}</SignOutToSignInButton>
        </div>
      </section>
    </PublicShell>
  );
}
