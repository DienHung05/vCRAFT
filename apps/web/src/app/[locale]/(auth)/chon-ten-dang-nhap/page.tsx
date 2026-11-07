import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { AuthShell } from '@/features/auth/auth-shell';
import { ChooseUsernameForm } from '@/features/auth/choose-username-form';
import { getPathname } from '@/i18n/navigation';
import { firstParam, safeReturnTo } from '@/lib/auth/return-to';
import { getViewer } from '@/lib/auth/viewer';
import { resolveLocale } from '@/lib/locale';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('auth.username');
  return { title: t('title'), robots: { index: false } };
}

export default async function ChooseUsernamePage({
  params,
  searchParams,
}: PageProps<'/[locale]/chon-ten-dang-nhap'>) {
  const locale = await resolveLocale(params);
  const next = safeReturnTo(firstParam((await searchParams).next));
  const viewer = await getViewer();
  if (!viewer) redirect(getPathname({ href: '/dang-nhap', locale }));
  if (viewer.username)
    redirect(`/auth/continue?locale=${locale}${next ? `&next=${encodeURIComponent(next)}` : ''}`);
  const t = await getTranslations('auth.username');
  return (
    <AuthShell title={t('title')} lead={t('lead')}>
      <ChooseUsernameForm next={next} />
    </AuthShell>
  );
}
