import { Badge } from '@vcraft/ui';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getFormatter, getTranslations } from 'next-intl/server';
import { AllocationBoard, type AllocationPart } from '@/features/admin/allocation-board';
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

/** Chia đơn cho RFQ cần điều phối (FR-ORD-03): đề xuất theo BR-06, Admin chỉnh tay, Σ phải đúng. */
export default async function CoordinationPage({
  params,
}: PageProps<'/[locale]/admin/dieu-phoi/[code]'>) {
  await resolveLocale(params);
  const { code } = await params;
  const coordination = await getCoordination(code);
  if (!coordination) notFound();
  const [t, format] = await Promise.all([getTranslations('admin.coordination'), getFormatter()]);

  const artisans = await Promise.all(coordination.candidates.map((c) => getArtisan(c.artisanSlug)));
  // Thứ tự `parts` phải khớp `plans`, nên thiếu một hộ là dữ liệu hỏng chứ không bỏ qua.
  if (artisans.some((a) => a === null)) notFound();
  const parts: AllocationPart[] = coordination.candidates.map((c, i) => ({
    slug: c.artisanSlug,
    name: artisans[i]?.household ?? c.artisanSlug,
    tint: artisans[i]?.tint ?? 'currentColor',
    capacity: c.capacity,
    unitPrice: c.unitPrice,
    leadDays: c.leadDays,
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
        rfqCode={coordination.rfqCode}
        quantity={coordination.quantity}
        unit={coordination.unit}
        requiredBy={coordination.requiredBy}
        parts={parts}
        plans={coordination.plans}
      />
    </article>
  );
}
