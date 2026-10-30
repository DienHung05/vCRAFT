import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { NotificationInbox } from '@/features/notifications/notification-inbox';
import { LiveAllocationWorkspace } from '@/features/orders/live-allocation-workspace';
import { LiveContributionWorkspace } from '@/features/rfq/live-contribution-workspace';
import { isRfqUuid } from '@/lib/api/rfq-id';
import { resolveLocale } from '@/lib/locale';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/studio/de-xuat-tham-gia/[id]'>): Promise<Metadata> {
  const { id } = await params;
  return { title: isRfqUuid(id) ? id : 'Contribution', robots: { index: false } };
}

/**
 * Màn đề xuất tham gia của hộ (GH#10) cho yêu cầu thật: yêu cầu UUID tải qua API với phiên
 * đại diện hộ; hộ khai mức tối đa, đơn giá, ngày hoàn thành; gửi/rút đi qua API. Mã không phải
 * UUID thì không có trang (yêu cầu mẫu chỉ tồn tại ở màn Admin demo).
 */
export default async function ContributionPage({
  params,
}: PageProps<'/[locale]/studio/de-xuat-tham-gia/[id]'>) {
  await resolveLocale(params);
  const { id } = await params;
  if (!isRfqUuid(id)) notFound();
  const t = await getTranslations('contribution');

  return (
    <article className="mx-auto flex max-w-3xl flex-col gap-8 px-gutter pt-8">
      <header className="flex flex-col gap-2">
        <nav aria-label={t('title', { code: id })} className="text-small text-ash">
          <span aria-current="page" className="font-mono text-ink">
            {id}
          </span>
        </nav>
      </header>
      <NotificationInbox />
      <LiveContributionWorkspace rfqId={id} />
      <LiveAllocationWorkspace rfqId={id} />
    </article>
  );
}
