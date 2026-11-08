'use client';

import type { MaterialPriceSeriesDto } from '@vcraft/contracts';
import { useFormatter, useTranslations } from 'next-intl';
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

export interface PriceLineChartProps {
  /** One row per month: the formatted month plus each material's price indexed to its first month (= 100). */
  rows: Record<string, number | string>[];
  series: MaterialPriceSeriesDto['series'];
  /** Real price of a material in a (formatted) month, for the tooltip. */
  priceOf: (material: string, month: string) => number | undefined;
}

/** The recharts line of `MaterialPriceChart`, kept in its own module so the library loads on demand. */
export function PriceLineChart({ rows, series, priceOf }: PriceLineChartProps) {
  const t = useTranslations('news.materialPrices');
  const format = useFormatter();
  return (
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
  );
}
