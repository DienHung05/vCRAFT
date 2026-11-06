import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { AuthShell } from '@/features/auth/auth-shell';
import { SignInForm } from '@/features/auth/sign-in-form';
import { redirectIfSignedIn } from '@/lib/auth/guard';
import { firstParam, safeReturnTo } from '@/lib/auth/return-to';
import { resolveLocale } from '@/lib/locale';

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/dang-nhap'>): Promise<Metadata> {
  await resolveLocale(params);
  const t = await getTranslations('auth.signIn');
  return { title: t('title'), robots: { index: false } };
}

/** Đăng nhập (FR-AUTH-04). `?next=` là đích quay lại do guard của layout đặt, đã lọc chống open redirect. */
export default async function SignInPage({
  params,
  searchParams,
}: PageProps<'/[locale]/dang-nhap'>) {
  const locale = await resolveLocale(params);
  const query = await searchParams;
  const next = safeReturnTo(firstParam(query.next));
  await redirectIfSignedIn(locale, next);
  const t = await getTranslations('auth.signIn');

  return (
    <AuthShell title={t('title')} lead={t('lead')}>
      <SignInForm
        next={next}
        needSignIn={next !== null}
        linkInvalid={firstParam(query.error) === 'link_invalid'}
        oauthFailed={firstParam(query.error) === 'oauth_failed'}
      />
    </AuthShell>
  );
}
