import type { HouseholdDto } from '@vcraft/contracts';
import { Badge, type BadgeProps, Card, Stepper } from '@vcraft/ui';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { FormAlert } from '@/features/auth/fields';
import { PendingApplicationEditor } from '@/features/auth/pending-application-editor';
import { ResubmitApplication } from '@/features/auth/resubmit-application';
import { ProfileEditor } from '@/features/studio/profile-editor';
import { Link, redirect } from '@/i18n/navigation';
import { firstParam } from '@/lib/auth/return-to';
import { getViewer } from '@/lib/auth/viewer';
import { resolveLocale } from '@/lib/locale';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/studio/ho-so'>): Promise<Metadata> {
  await resolveLocale(params);
  const t = await getTranslations('auth.profile');
  return { title: t('title'), robots: { index: false } };
}

type Status = HouseholdDto['status'];

const BADGE_TONE: Record<Status, NonNullable<BadgeProps['tone']>> = {
  PENDING_REVIEW: 'lacquer',
  APPROVED: 'celadon',
  REJECTED: 'seal',
  SUSPENDED: 'outline',
};

/** Vị trí trên thanh tiến trình và việc có đang "dừng" (son triện) hay không. */
const PROGRESS: Record<Status, { current: number; halted: boolean }> = {
  PENDING_REVIEW: { current: 1, halted: false },
  APPROVED: { current: 2, halted: false },
  REJECTED: { current: 1, halted: true },
  SUSPENDED: { current: 2, halted: true },
};

const COPY = {
  PENDING_REVIEW: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  SUSPENDED: 'suspended',
} as const;

/**
 * Hộ đã được duyệt sửa hồ sơ ở đây (FR-ART); hộ khác chỉ thấy trạng thái.
 *
 * Trang trạng thái hồ sơ hộ (FR-AUTH-02): nơi duy nhất của Studio mà hộ đang chờ duyệt (hoặc bị từ
 * chối) được vào. Cũng là đích sau đăng nhập của người đại diện hộ.
 */
export default async function HouseholdProfilePage({
  params,
  searchParams,
}: PageProps<'/[locale]/studio/ho-so'>) {
  const locale = await resolveLocale(params);
  const query = await searchParams;
  const viewer = await getViewer();
  const household = viewer?.household;
  // Vai trò hộ mà chưa có hồ sơ không xảy ra bình thường; đưa về wizard để nộp.
  if (!household) return redirect({ href: '/dang-ky-nghe-nhan', locale });

  if (household.status === 'APPROVED' && firstParam(query.submitted) !== '1') {
    return <ProfileEditor />;
  }

  const t = await getTranslations('auth.profile');
  const copy = COPY[household.status];
  const progress = PROGRESS[household.status];

  return (
    <article className="mx-auto flex max-w-3xl flex-col gap-6 px-gutter pt-10 pb-section">
      {firstParam(query.submitted) === '1' ? (
        <FormAlert tone="success">{t('submitted')}</FormAlert>
      ) : null}
      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3 text-small text-ash">
          <span>{t('statusLabel')}</span>
          <Badge tone={BADGE_TONE[household.status]}>{t(`status.${household.status}`)}</Badge>
        </div>
        <h1 className="text-h2 text-glaze">{t(`${copy}.title`, { name: household.name })}</h1>
        <p className="text-ash">{t(`${copy}.lead`)}</p>
      </header>

      <Card className="p-5 md:p-8">
        <Stepper
          label={t('stepsLabel')}
          current={progress.current}
          state={progress.halted ? 'halted' : 'active'}
          steps={[
            { id: 'submitted', label: t('steps.submitted') },
            { id: 'review', label: t('steps.review') },
            { id: 'accepted', label: t('steps.accepted') },
          ]}
        />
      </Card>

      {household.statusReason ? (
        <Card className="p-5">
          <h2 className="font-sans text-small font-semibold tracking-wide text-ash uppercase">
            {t('reason')}
          </h2>
          <p className="mt-2">{household.statusReason}</p>
        </Card>
      ) : null}

      {household.status === 'PENDING_REVIEW' ? <PendingApplicationEditor /> : null}

      {household.status === 'PENDING_REVIEW' && household.statusReason ? (
        <ResubmitApplication householdId={household.id} />
      ) : null}

      {household.status === 'APPROVED' ? (
        <Link
          href={{ pathname: '/nghe-nhan/[slug]', params: { slug: household.slug } }}
          className="self-start text-small text-clay underline underline-offset-4"
        >
          {t('publicPage')}
        </Link>
      ) : null}
    </article>
  );
}
