import { Badge, Card } from '@vcraft/ui';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { ChangePasswordForm } from '@/features/account/change-password-form';
import { EmailPreferencesForm } from '@/features/account/email-preferences-form';
import { Link } from '@/i18n/navigation';
import { workspacePath } from '@/lib/auth/access';
import { requireViewer } from '@/lib/auth/guard';
import { resolveLocale } from '@/lib/locale';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/tai-khoan'>): Promise<Metadata> {
  await resolveLocale(params);
  const t = await getTranslations('account');
  return { title: t('title'), robots: { index: false } };
}

/**
 * Trang tài khoản cho mọi vai trò (GH#37, FR-AUTH-06, FR-NOTI-02): thông tin cơ bản, đổi mật khẩu
 * (đăng xuất các thiết bị khác) và chọn loại thông báo nào cũng gửi email. Khách bị chuyển tới
 * đăng nhập rồi quay lại đây.
 */
export default async function AccountPage({ params }: PageProps<'/[locale]/tai-khoan'>) {
  const locale = await resolveLocale(params);
  const viewer = await requireViewer(locale);
  const [t, tAuth, privacy] = await Promise.all([
    getTranslations('account'),
    getTranslations('auth'),
    getTranslations('privacy'),
  ]);
  const workspace = workspacePath(viewer.role);

  return (
    <article className="mx-auto flex max-w-3xl flex-col gap-8 px-gutter pt-10 pb-section">
      <header className="flex flex-col gap-2">
        <h1 className="text-h2 text-glaze">{t('title')}</h1>
        <p className="text-ash">{t('lead')}</p>
      </header>

      <Card className="p-5 md:p-8">
        <h2 className="mb-4 font-display text-h3 text-glaze">{t('profile.title')}</h2>
        <dl className="grid gap-x-8 gap-y-3 text-small sm:grid-cols-[10rem_1fr]">
          <dt className="text-ash">{t('profile.email')}</dt>
          <dd className="flex min-w-0 flex-wrap items-center gap-2">
            <span className="break-all">{viewer.email}</span>
            <Badge tone={viewer.emailVerified ? 'celadon' : 'outline'}>
              {viewer.emailVerified ? t('profile.emailVerified') : t('profile.emailUnverified')}
            </Badge>
          </dd>
          <dt className="text-ash">{t('profile.name')}</dt>
          <dd>{viewer.fullName ?? <span className="text-ash">{t('profile.notSet')}</span>}</dd>
          <dt className="text-ash">{t('profile.role')}</dt>
          <dd>
            <Badge tone="glaze">{tAuth(`roles.${viewer.role}`)}</Badge>
          </dd>
          {viewer.household ? (
            <>
              <dt className="text-ash">{t('profile.household')}</dt>
              <dd>{viewer.household.name}</dd>
              <dt className="text-ash">{t('profile.householdStatus')}</dt>
              <dd>{tAuth(`profile.status.${viewer.household.status}`)}</dd>
            </>
          ) : null}
        </dl>
        <Link
          href={workspace}
          className="mt-5 inline-block text-clay text-small underline underline-offset-4"
        >
          {t('profile.workspace')}
        </Link>
      </Card>

      <Card className="p-5 md:p-8">
        <h2 className="font-display text-h3 text-glaze">{privacy('account.title')}</h2>
        <p className="mt-1 mb-4 text-ash text-small">{privacy('account.lead')}</p>
        <Link
          href="/chinh-sach-quyen-rieng-tu"
          className="text-clay text-small underline underline-offset-4"
        >
          {privacy('account.link')}
        </Link>
      </Card>

      <Card className="p-5 md:p-8">
        <h2 className="font-display text-h3 text-glaze">{t('password.title')}</h2>
        <p className="mt-1 mb-5 text-ash text-small">{t('password.lead')}</p>
        <ChangePasswordForm email={viewer.email} />
      </Card>

      <Card className="p-5 md:p-8">
        <h2 className="font-display text-h3 text-glaze">{t('email.title')}</h2>
        <p className="mt-1 mb-5 text-ash text-small">{t('email.lead')}</p>
        <EmailPreferencesForm />
      </Card>
    </article>
  );
}
