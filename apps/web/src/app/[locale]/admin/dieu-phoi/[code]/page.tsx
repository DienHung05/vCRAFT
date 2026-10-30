import { Badge } from '@vcraft/ui';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getFormatter, getTranslations } from 'next-intl/server';
import { AllocationBoard, type BoardContribution } from '@/features/admin/allocation-board';
import { LiveCoordination } from '@/features/admin/live-coordination';
import { NotificationInbox } from '@/features/notifications/notification-inbox';
import { isRfqUuid } from '@/lib/api/rfq-id';
import { demoParams, getArtisan, getCoordination } from '@/lib/demo/data';
import { resolveLocale } from '@/lib/locale';

// Hạn giao của dữ liệu mẫu tính theo thời điểm hiện tại, nên dựng lại định kỳ để demo không tự hỏng.
export const revalidate = 3600;

export function generateStaticParams() {
  return demoParams.coordinations.map((code) => ({ code }));
}

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/admin/dieu-phoi/[code]'>): Promise<Metadata> {
  const { code } = await params;
  const c = await getCoordination(code);
  return c ? { title: c.title, robots: { index: false } } : {};
}

/**
 * Màn điều phối cho hai chế độ, phân nhau bằng hình dạng mã trên đường dẫn:
 * - UUID yêu cầu thật: `LiveCoordination` — dữ liệu và gửi chào giá đi qua API với phiên đăng nhập
 *   sẵn có (GH#10). Không có phiên hoặc không có quyền thì màn nói rõ, không giả vờ.
 * - Mã mẫu `RFQ-*`: bảng chia đơn demo với dữ liệu minh họa, thao tác chỉ chạy trên trình duyệt.
 */
export default async function CoordinationPage({
  params,
}: PageProps<'/[locale]/admin/dieu-phoi/[code]'>) {
  await resolveLocale(params);
  const { code } = await params;
  if (isRfqUuid(code)) {
    return (
      <article className="mx-auto flex max-w-6xl flex-col gap-8">
        <header className="flex flex-col gap-3">
          <nav aria-label="Breadcrumb" className="text-small text-ash">
            <span aria-current="page" className="font-mono text-ink">
              {code}
            </span>
          </nav>
        </header>
        <NotificationInbox />
        <LiveCoordination rfqId={code} />
      </article>
    );
  }

  const coordination = await getCoordination(code);
  if (!coordination) notFound();
  const [t, format] = await Promise.all([getTranslations('admin.coordination'), getFormatter()]);

  // Mỗi đề xuất phải khớp một hộ đã duyệt; thiếu là dữ liệu mẫu hỏng chứ không bỏ qua.
  const artisans = await Promise.all(
    coordination.contributions.map((c) => getArtisan(c.householdId)),
  );
  if (artisans.some((a) => a === null)) notFound();
  const contributions: BoardContribution[] = coordination.contributions.map((c, i) => ({
    householdId: c.householdId,
    name: artisans[i]?.household ?? c.householdId,
    tint: artisans[i]?.tint ?? 'currentColor',
    maxQuantity: c.maxQuantity,
    unitPriceVnd: c.unitPriceVnd,
    completionDate: c.completionDate,
    contributionVersion: c.contributionVersion,
  }));

  return (
    <article className="mx-auto flex max-w-6xl flex-col gap-8">
      <header className="flex flex-col gap-3">
        <nav aria-label={t('breadcrumb')} className="text-small text-ash">
          <span>{t('section')}</span>
          <span aria-hidden="true"> / </span>
          <span aria-current="page" className="font-mono text-ink">
            {coordination.rfqCode}
          </span>
        </nav>
        <h1 className="text-h2">{coordination.title}</h1>
        <dl className="flex flex-wrap gap-x-8 gap-y-2 text-small">
          <div className="flex gap-2">
            <dt className="text-ash">{t('buyer')}</dt>
            <dd>{coordination.buyer}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="text-ash">{t('quantity')}</dt>
            <dd>
              {format.number(coordination.quantity)} {coordination.unit}
            </dd>
          </div>
          <div className="flex gap-2">
            <dt className="text-ash">{t('requiredBy')}</dt>
            <dd>
              <time dateTime={coordination.requiredBy}>
                {format.dateTime(new Date(coordination.requiredBy), 'long')}
              </time>
            </dd>
          </div>
        </dl>
        <p className="flex flex-wrap items-center gap-2 text-small text-ash">
          <Badge tone="clay">{t('reasonLabel')}</Badge>
          {t(`reason.${coordination.reason}`)}
        </p>
      </header>

      <AllocationBoard
        rfqId={coordination.rfqCode}
        rfqCode={coordination.rfqCode}
        requestVersion={0}
        quantity={coordination.quantity}
        unit={coordination.unit}
        biddingClosesAt={coordination.biddingClosesAt}
        requiredBy={coordination.requiredBy}
        contributions={contributions}
      />
    </article>
  );
}
