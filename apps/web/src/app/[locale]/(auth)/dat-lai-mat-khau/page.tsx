import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { AuthShell } from '@/features/auth/auth-shell';
import { SetPasswordForm } from '@/features/auth/set-password-form';
import { firstParam } from '@/lib/auth/return-to';
import { hasServerSession } from '@/lib/auth/viewer';
import { resolveLocale } from '@/lib/locale';

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/dat-lai-mat-khau'>): Promise<Metadata> {
  await resolveLocale(params);
  const t = await getTranslations('auth.reset');
  return { title: t('title'), robots: { index: false } };
}

/**
 * Trang đích của liên kết trong thư "đặt lại mật khẩu" (`?token_hash=…&type=recovery`). Mã chỉ bị
 * tiêu thụ khi người dùng bấm lưu mật khẩu mới, không phải lúc mở trang.
 */
export default async function ResetPasswordPage({
  params,
  searchParams,
}: PageProps<'/[locale]/dat-lai-mat-khau'>) {
  await resolveLocale(params);
  const query = await searchParams;
  const tokenHash = firstParam(query.token_hash)?.trim() || null;
  const t = await getTranslations('auth.reset');

  return (
    <AuthShell title={t('title')} lead={t('lead')}>
      <SetPasswordForm
        mode="recovery"
        tokenHash={tokenHash}
        hasSession={await hasServerSession()}
      />
    </AuthShell>
  );
}
