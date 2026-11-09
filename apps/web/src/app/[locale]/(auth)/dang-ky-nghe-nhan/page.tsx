import type { Metadata } from 'next';
import { forbidden } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { AuthShell } from '@/features/auth/auth-shell';
import { FormAlert } from '@/features/auth/fields';
import { HouseholdWizard } from '@/features/auth/household-wizard';
import { resolveWizardStart } from '@/features/auth/wizard-steps';
import { getPathname, Link, redirect } from '@/i18n/navigation';
import { getViewer, serverAccountClient, ViewerUnavailableError } from '@/lib/auth/viewer';
import { resolveLocale } from '@/lib/locale';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/dang-ky-nghe-nhan'>): Promise<Metadata> {
  await resolveLocale(params);
  const t = await getTranslations('auth.wizard');
  return { title: t('title'), robots: { index: false } };
}

/**
 * Wizard đăng ký hộ (FR-AUTH-02). Bước bắt đầu suy từ CSDL: khách → tạo tài khoản, Buyer → thông tin
 * hộ, hộ đang chờ duyệt → xưởng hoặc giấy tờ còn thiếu. Quản trị viên không đăng ký hộ được.
 */
export default async function RegisterHouseholdPage({
  params,
}: PageProps<'/[locale]/dang-ky-nghe-nhan'>) {
  const locale = await resolveLocale(params);
  const t = await getTranslations('auth.wizard');
  const areas = await getTranslations('auth.areas');
  const viewer = await getViewer();
  if (viewer?.status === 'LOCKED') forbidden();

  // Hồ sơ còn là bản nháp: đếm xưởng đã có để biết còn thiếu bước nào.
  let workshopCount = 0;
  if (viewer?.household?.status === 'DRAFT') {
    try {
      const client = await serverAccountClient();
      workshopCount = (await client?.getMyHousehold())?.workshops.length ?? 0;
    } catch {
      // API chậm hoặc sập: không đoán bước, để `error.tsx` cho thử lại.
      throw new ViewerUnavailableError();
    }
  }

  const entry = resolveWizardStart(viewer, workshopCount);
  if (entry.kind === 'profile') return redirect({ href: '/studio/ho-so', locale });

  return (
    <AuthShell title={t('title')} lead={t('lead')} wide>
      {entry.kind === 'blocked' ? (
        <div className="flex flex-col gap-3">
          <FormAlert tone="info">{t('alreadyAdmin')}</FormAlert>
          <Link href="/admin" className="text-small text-clay underline underline-offset-4">
            {areas('ADMIN')}
          </Link>
        </div>
      ) : (
        <HouseholdWizard
          initialStep={entry.step}
          wizardPath={getPathname({ href: '/dang-ky-nghe-nhan', locale })}
        />
      )}
    </AuthShell>
  );
}
