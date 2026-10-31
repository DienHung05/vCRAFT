import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { AuthShell } from '@/features/auth/auth-shell';
import { SetPasswordForm } from '@/features/auth/set-password-form';
import { firstParam } from '@/lib/auth/return-to';
import { hasServerSession } from '@/lib/auth/viewer';
import { resolveLocale } from '@/lib/locale';

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/chap-nhan-loi-moi'>): Promise<Metadata> {
  await resolveLocale(params);
  const t = await getTranslations('auth.invitation');
  return { title: t('title'), robots: { index: false } };
}

/**
 * Trang đích của thư mời hộ do Ban quản lý gửi (FR-AUTH-03, `?token_hash=…&type=invite`): hộ đặt
 * mật khẩu để kích hoạt tài khoản. Liên kết dùng một lần; mã chỉ bị tiêu thụ khi bấm gửi.
 */
export default async function AcceptInvitationPage({
  params,
  searchParams,
}: PageProps<'/[locale]/chap-nhan-loi-moi'>) {
  await resolveLocale(params);
  const query = await searchParams;
  const tokenHash = firstParam(query.token_hash)?.trim() || null;
  const t = await getTranslations('auth.invitation');

  return (
    <AuthShell title={t('title')} lead={t('lead')}>
      <SetPasswordForm mode="invite" tokenHash={tokenHash} hasSession={await hasServerSession()} />
    </AuthShell>
  );
}
