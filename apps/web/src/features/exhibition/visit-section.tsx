import { splitWorkshops } from '@vcraft/domain';
import { Card, cn } from '@vcraft/ui';
import { useTranslations } from 'next-intl';
import type { DemoWorkshop } from '@/lib/demo/data';
import { MapWithList } from './map-with-list';

export interface VisitSectionProps {
  household: string;
  workshops: readonly DemoWorkshop[];
  className?: string;
}

/**
 * Ghé thăm (vCRAFT-9hg.6): phòng trưng bày đón khách đứng riêng; xưởng chỉ để sản xuất được liệt kê
 * gọn bên dưới (không làm thẻ "đóng cửa"). Bản đồ luôn có danh sách chữ đi kèm.
 */
export function VisitSection({ household, workshops, className }: VisitSectionProps) {
  const t = useTranslations('exhibition');
  const { showrooms, production } = splitWorkshops(workshops);
  return (
    <section id="workshop" aria-labelledby="visit-title" className={cn('scroll-mt-24', className)}>
      <h2 id="visit-title">{t('visitTitle')}</h2>
      <p className="mt-2 text-small text-ash">{t('visitLead')}</p>

      <div className="mt-8 grid gap-6 md:grid-cols-2">
        <div>
          <h3 id="showrooms-title" className="text-h3">
            {t('showroomsTitle')}
          </h3>
          {showrooms.length > 0 ? (
            <ul className="mt-4 space-y-4" data-testid="showrooms">
              {showrooms.map((w) => (
                <li key={w.id}>
                  <Card className="bg-celadon/10 p-6">
                    <p className="font-display text-h3">{w.name}</p>
                    <p className="mt-1 text-small text-ash">{w.address}</p>
                    {w.visitingInfo ? <p className="mt-3 text-small">{w.visitingInfo}</p> : null}
                  </Card>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-small text-ash">{t('showroomsEmpty')}</p>
          )}
        </div>
        {production.length > 0 ? (
          <div>
            <h3 id="production-title" className="text-h3">
              {t('productionTitle')}
            </h3>
            <p className="mt-1 text-small text-ash">{t('productionNote')}</p>
            <ul className="mt-4 space-y-2 text-small" data-testid="production-workshops">
              {production.map((w) => (
                <li key={w.id}>
                  <span className="font-medium">{w.name}</span> · {w.address}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      <div className="mt-10">
        <MapWithList
          places={workshops.map((w) => ({
            id: w.id,
            name: w.name,
            household,
            address: w.address,
            visitable: showrooms.includes(w),
            pin: w.pin,
          }))}
          {...(showrooms[0] && { highlight: showrooms[0].id })}
        />
      </div>
    </section>
  );
}
