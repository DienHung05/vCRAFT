'use client';

import type { MaterialPriceSeriesDto } from '@vcraft/contracts';
import dynamic from 'next/dynamic';
import { useFormatter, useTranslations } from 'next-intl';
import { useId } from 'react';

/**
 * The line chart pulls in recharts (~100 KB gzip), so it loads after hydration: the chart is decorative
 * (`aria-hidden`) and everything it shows is also in the text below, which the server renders.
 */
const PriceLineChart = dynamic(
  () => import('./material-price-line-chart').then((m) => m.PriceLineChart),
  {
    ssr: false,
  },
);

type Series = MaterialPriceSeriesDto['series'];

/**
 * Six months of clay, glaze and gas prices (PLAN E11). Each material is indexed to its first month (= 100)
 * so the three move on one axis despite very different prices; the real prices are in the tooltip and in
 * the table below the chart, which is also what screen readers get.
 */
export function MaterialPriceChart({ series }: { series: Series }) {
  const t = useTranslations('news.materialPrices');
  const format = useFormatter();
  const tableId = useId();
  if (series.length === 0) return null;
  const months = [...new Set(series.flatMap((s) => s.points.map((p) => p.month)))].sort();
  const label = (month: string) =>
    format.dateTime(new Date(`${month}-01T00:00:00`), { month: 'short', year: 'numeric' });
  const rows = months.map((month) => {
    const row: Record<string, number | string> = { month: label(month) };
    for (const s of series) {
      const point = s.points.find((p) => p.month === month);
      const base = s.points[0]?.priceVnd;
      if (point && base) row[s.material] = Math.round((point.priceVnd / base) * 1000) / 10;
    }
    return row;
  });
  const priceOf = (material: string, month: string) =>
    series.find((s) => s.material === material)?.points.find((p) => label(p.month) === month)
      ?.priceVnd;

  return (
    <section aria-labelledby={`${tableId}-title`} className="flex flex-col gap-3">
      <div>
        <h2 id={`${tableId}-title`} className="text-h3">
          {t('title')}
        </h2>
        <p className="text-small text-ash">{t('lead')}</p>
      </div>
      <div aria-hidden="true" className="h-64 w-full">
        <PriceLineChart rows={rows} series={series} priceOf={priceOf} />
      </div>
      <div className="sr-only">
        <table id={tableId}>
          <caption>{t('tableCaption')}</caption>
          <thead>
            <tr>
              <th scope="col">{t('month')}</th>
              {series.map((s) => (
                <th key={s.material} scope="col">
                  {t(`materials.${s.material}`)} ({s.unit})
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {months.map((month) => (
              <tr key={month}>
                <th scope="row">{label(month)}</th>
                {series.map((s) => {
                  const point = s.points.find((p) => p.month === month);
                  return (
                    <td key={s.material}>{point ? format.number(point.priceVnd, 'vnd') : '–'}</td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="flex flex-wrap gap-x-6 gap-y-1 text-small text-ash">
        {series.map((s) => {
          const last = s.points.at(-1);
          return last ? (
            <li key={s.material}>
              {t('latest', {
                material: t(`materials.${s.material}`),
                price: format.number(last.priceVnd, 'vnd'),
                unit: s.unit,
              })}
            </li>
          ) : null;
        })}
      </ul>
    </section>
  );
}
