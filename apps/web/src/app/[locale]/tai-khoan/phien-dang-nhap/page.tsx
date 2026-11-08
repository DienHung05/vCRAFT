import { Card } from '@vcraft/ui';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { SessionUnavailable } from '@/components/session-unavailable';
import { AccountSecurity } from '@/features/account/account-security';
import { Link } from '@/i18n/navigation';
import { requireViewer } from '@/lib/auth/guard';
import { resolveLocale } from '@/lib/locale';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/tai-khoan/phien-dang-nhap'>): Promise<Metadata> {
  await resolveLocale(params);
  const t = await getTranslations('account.sessions');
  return { title: t('title'), robots: { index: false } };
}

/**
 * Sign-in sessions of the account (FR-AUTH-05, SRS 5.1): recent sign-ins with browser and rough
 * location, and the actions to sign out other devices or every device. Guests go to sign-in and come back.
 */
export default async function AccountSessionsPage({
  params,
}: PageProps<'/[locale]/tai-khoan/phien-dang-nhap'>) {
  const locale = await resolveLocale(params);
  const viewer = await requireViewer(locale);
  // The API could not confirm the session: stay inside the shell with a retry instead of a 500 page.
  if (!viewer) return <SessionUnavailable />;
  const t = await getTranslations('account.sessions');

  return (
    <article className="mx-auto flex max-w-3xl flex-col gap-8 px-gutter pt-10 pb-section">
      <header className="flex flex-col gap-2">
        <h1 className="text-h2 text-glaze">{t('title')}</h1>
        <p className="text-ash">{t('lead')}</p>
      </header>
      <Card className="p-5 md:p-8">
        <AccountSecurity />
      </Card>
      <Link href="/tai-khoan" className="text-clay text-small underline underline-offset-4">
        {t('back')}
      </Link>
    </article>
  );
}
