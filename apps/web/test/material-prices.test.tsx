import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { EMPTY_STRUCTURED, structuredRequest } from '@/features/admin/structured-news-fields';
import { MaterialPriceChart } from '@/features/news/material-price-chart';
import { OutageBanner } from '@/features/studio/outage-banner';
import { renderVi } from './render';

vi.mock('@/i18n/navigation', () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a href="/x">{children}</a>,
}));

// Recharts measures its container; jsdom has no layout, so the chart body renders empty.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;

describe('MaterialPriceChart', () => {
  it('gives screen readers every month and the latest prices in text', () => {
    renderVi(
      <MaterialPriceChart
        series={[
          {
            material: 'CLAY',
            unit: 'tấn',
            points: [
              { month: '2026-10', priceVnd: 1_220_000 },
              { month: '2026-11', priceVnd: 1_250_000 },
            ],
          },
        ]}
      />,
    );
    expect(screen.getByRole('heading', { name: 'Giá nguyên liệu 6 tháng' })).toBeTruthy();
    const table = screen.getByRole('table', { name: 'Giá nguyên liệu theo tháng' });
    expect(table.querySelectorAll('tbody tr')).toHaveLength(2);
    expect(screen.getByText(/Đất sét: 1\.250\.000\s₫\/tấn/)).toBeTruthy();
  });

  it('renders nothing without data', () => {
    const { container } = renderVi(<MaterialPriceChart series={[]} />);
    expect(container.textContent).toBe('');
  });
});

describe('OutageBanner', () => {
  it('lists today’s cuts', async () => {
    const client = {
      todayOutages: vi.fn(async () => ({
        date: '2026-11-03',
        outages: [{ from: '08:00', to: '11:30', area: 'Xóm 2', newsSlug: 'lich-cat-dien' }],
      })),
    };
    renderVi(<OutageBanner client={client as never} />);
    await waitFor(() =>
      expect(screen.getByRole('status').textContent).toContain('08:00–11:30 (Xóm 2)'),
    );
    expect(screen.getByText('Hôm nay cắt điện')).toBeTruthy();
  });

  it('stays hidden on a day without cuts', async () => {
    const client = { todayOutages: vi.fn(async () => ({ date: '2026-11-03', outages: [] })) };
    const { container } = renderVi(<OutageBanner client={client as never} />);
    await waitFor(() => expect(client.todayOutages).toHaveBeenCalled());
    expect(container.textContent).toBe('');
  });
});

describe('structuredRequest', () => {
  it('sends filled prices with their units for a price notice', () => {
    expect(
      structuredRequest('MATERIAL_PRICES', {
        ...EMPTY_STRUCTURED,
        effectiveOn: '2026-11-01',
        prices: { CLAY: '1250000', GLAZE: '', GAS: '470000' },
      }),
    ).toEqual({
      materialPrices: {
        effectiveOn: '2026-11-01',
        prices: [
          { material: 'CLAY', unit: 'tấn', priceVnd: 1_250_000 },
          { material: 'GAS', unit: 'bình 12 kg', priceVnd: 470_000 },
        ],
      },
    });
  });

  it('sends the cut for an outage notice and nothing for other categories', () => {
    const values = {
      ...EMPTY_STRUCTURED,
      outage: { date: '2026-11-03', from: '08:00', to: '11:30', area: ' Xóm 2 ' },
    };
    expect(structuredRequest('POWER_SCHEDULE', values)).toEqual({
      powerSchedule: {
        outages: [{ date: '2026-11-03', from: '08:00', to: '11:30', area: 'Xóm 2' }],
      },
    });
    expect(structuredRequest('GENERAL', values)).toEqual({});
  });
});
