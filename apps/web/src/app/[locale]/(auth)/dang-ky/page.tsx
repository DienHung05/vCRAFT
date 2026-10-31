import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { AuthShell } from '@/features/auth/auth-shell';
import { RegisterForm } from '@/features/auth/register-form';
import { redirectIfSignedIn } from '@/lib/auth/guard';
import { resolveLocale } from '@/lib/locale';

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/dang-ky'>): Promise<Metadata> {
  await resolveLocale(params);
  const t = await getTranslations('auth.register');
  return { title: t('title'), robots: { index: false } };
}

/** Đăng ký tài khoản Buyer, bắt buộc xác minh email (FR-AUTH-01). */
export default async function RegisterPage({ params }: PageProps<'/[locale]/dang-ky'>) {
  const locale = await resolveLocale(params);
  await redirectIfSignedIn(locale, null);
  const t = await getTranslations('auth.register');

  return (
    <AuthShell title={t('title')} lead={t('lead')}>
      <RegisterForm />
    </AuthShell>
  );
}
