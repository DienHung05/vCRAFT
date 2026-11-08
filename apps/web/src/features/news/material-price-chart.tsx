'use client';

import type { MaterialPriceSeriesDto } from '@vcraft/contracts';
import { useFormatter, useTranslations } from 'next-intl';
import { useId } from 'react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

// Brand colours (packages/ui tokens) per material; CSS variables follow the light/dark theme.
const COLOURS = {
  CLAY: 'var(--color-clay)',
  GLAZE: 'var(--color-glaze)',
  GAS: 'var(--color-ash)',
} as const;

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
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rows} margin={{ top: 8, right: 16, bottom: 0, left: -12 }}>
            <CartesianGrid stroke="var(--color-ink)" strokeOpacity={0.08} vertical={false} />
            <XAxis dataKey="month" tick={{ fill: 'var(--color-ash)', fontSize: 12 }} />
            <YAxis
              domain={['dataMin - 2', 'dataMax + 2']}
              tick={{ fill: 'var(--color-ash)', fontSize: 12 }}
              tickFormatter={(value: number) => String(Math.round(value))}
            />
            <Tooltip
              contentStyle={{
                background: 'var(--color-surface)',
                border: '1px solid color-mix(in oklch, var(--color-ink) 12%, transparent)',
                borderRadius: 8,
                color: 'var(--color-ink)',
              }}
              formatter={(value, name, item) => {
                const price = priceOf(String(name), String(item.payload.month));
                return [
                  price === undefined ? String(value) : format.number(price, 'vnd'),
                  t(`materials.${name as keyof typeof COLOURS}`),
                ];
              }}
            />
            <Legend formatter={(name) => t(`materials.${name as keyof typeof COLOURS}`)} />
            {series.map((s) => (
              <Line
                key={s.material}
                type="monotone"
                dataKey={s.material}
                stroke={COLOURS[s.material]}
                strokeWidth={2}
                dot={{ r: 3 }}
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
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
