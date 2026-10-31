import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { AuthShell } from '@/features/auth/auth-shell';
import { ForgotPasswordForm } from '@/features/auth/forgot-password-form';
import { resolveLocale } from '@/lib/locale';

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/quen-mat-khau'>): Promise<Metadata> {
  await resolveLocale(params);
  const t = await getTranslations('auth.forgot');
  return { title: t('title'), robots: { index: false } };
}

/** Quên mật khẩu (FR-AUTH-06): gửi liên kết đặt lại qua email. */
export default async function ForgotPasswordPage({ params }: PageProps<'/[locale]/quen-mat-khau'>) {
  await resolveLocale(params);
  const t = await getTranslations('auth.forgot');

  return (
    <AuthShell title={t('title')} lead={t('lead')}>
      <ForgotPasswordForm />
    </AuthShell>
  );
}
