import { getFormatter, getTranslations } from 'next-intl/server';
import { CountUp } from '@/experience/motion/count-up';
import { fetchVillageStats } from '@/features/catalog/exhibition-api';

/** Làng gốm Bát Tràng có từ khoảng thế kỷ 14 (số tròn, không phải số liệu trong CSDL). */
const VILLAGE_YEARS = 700;

/** The four village figures; the year is static, the three counts stream in. */
export async function VillageStats({ locale }: { locale: string }) {
  const [t, format, statsResult] = await Promise.all([
    getTranslations('home'),
    getFormatter(),
    fetchVillageStats(),
  ]);
  return (
    <dl className="grid grid-cols-2 gap-x-6 gap-y-10 md:grid-cols-4">
      {(['households', 'products', 'artisans', 'years'] as const).map((key) => {
        const value =
          key === 'years'
            ? `${VILLAGE_YEARS}+`
            : statsResult.status === 'ok'
              ? format.number(statsResult.data[key])
              : '—';
        return (
          <div key={key} className="border-clay/40 border-t pt-4">
            <dt className="text-small text-ash">{t(`stats.${key}`)}</dt>
            <dd className="mt-1 font-display text-h1 text-glaze type-soft">
              <CountUp text={value} locale={locale} />
            </dd>
          </div>
        );
      })}
    </dl>
  );
}
