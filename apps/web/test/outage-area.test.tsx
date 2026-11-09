import { fireEvent, screen, waitFor } from '@testing-library/react';
import type { StudioClient } from '@vcraft/api-client';
import type { AdminNewsDto, WorkshopDto } from '@vcraft/contracts';
import { describe, expect, it, vi } from 'vitest';
import {
  EMPTY_STRUCTURED,
  StructuredNewsFields,
  type StructuredValues,
  structuredRequest,
  structuredValuesOf,
} from '@/features/admin/structured-news-fields';
import { OutageBanner } from '@/features/studio/outage-banner';
import { WorkshopEditor } from '@/features/studio/workshop-editor';
import { renderEn, renderVi } from './render';

// Outage targeting by area (GH#294, ADR-0023): the notice editor, the workshop editor and the Studio prompt.
vi.mock('next/dynamic', () => ({ default: () => () => null }));
vi.mock('@/lib/notify', () => ({
  notify: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));
vi.mock('@/i18n/navigation', () => ({
  Link: ({ children, href }: { children: React.ReactNode; href: unknown }) => (
    <a href={typeof href === 'string' ? href : '/x'}>{children}</a>
  ),
}));

const WORKSHOP: WorkshopDto = {
  id: '00000000-0000-4000-8000-0000000000a1',
  version: 2,
  name: 'Lò nung',
  address: 'Xóm 3, Bát Tràng',
  purpose: 'BOTH',
  acceptsVisitors: false,
  visitingInfo: null,
  openingHours: null,
  experience: null,
  temporarilyClosed: false,
  closureReason: null,
  areaCode: null,
  lat: null,
  lng: null,
};

describe('StructuredNewsFields area code', () => {
  const values: StructuredValues = {
    ...EMPTY_STRUCTURED,
    outage: {
      date: '2026-11-09',
      from: '08:00',
      to: '11:30',
      area: 'Xóm 2',
      areaCode: 'VILLAGE_WIDE',
    },
  };

  it('offers every hamlet and the whole commune, and reports the choice', () => {
    const onChange = vi.fn();
    renderVi(
      <StructuredNewsFields category="POWER_SCHEDULE" values={values} onChange={onChange} />,
    );
    const select = screen.getByLabelText('Gửi tới') as HTMLSelectElement;
    expect([...select.options].map((o) => o.value)).toEqual([
      'BAT_TRANG',
      'GIANG_CAO',
      'VILLAGE_WIDE',
    ]);
    expect([...select.options].map((o) => o.textContent)).toEqual([
      'Thôn Bát Tràng',
      'Thôn Giang Cao',
      'Toàn xã',
    ]);
    expect(select.value).toBe('VILLAGE_WIDE');
    fireEvent.change(select, { target: { value: 'GIANG_CAO' } });
    expect(onChange).toHaveBeenCalledWith({
      ...values,
      outage: { ...values.outage, areaCode: 'GIANG_CAO' },
    });
    // The free-text area stays as a separate description.
    expect(screen.getByLabelText('Khu vực')).toBeTruthy();
  });

  it('is available in English', () => {
    renderEn(<StructuredNewsFields category="POWER_SCHEDULE" values={values} onChange={vi.fn()} />);
    expect(screen.getByLabelText('Send to')).toBeTruthy();
    expect(screen.getByRole('option', { name: 'Whole commune' })).toBeTruthy();
  });

  it('is not shown for other categories', () => {
    renderVi(<StructuredNewsFields category="GENERAL" values={values} onChange={vi.fn()} />);
    expect(screen.queryByLabelText('Gửi tới')).toBeNull();
  });

  it('defaults a new notice and a legacy cut without a code to the whole commune', () => {
    expect(EMPTY_STRUCTURED.outage.areaCode).toBe('VILLAGE_WIDE');
    const legacy = {
      powerSchedule: {
        outages: [{ date: '2026-11-09', from: '08:00', to: '11:30', area: 'Xóm 2' }],
      },
      materialPrices: null,
    } as AdminNewsDto;
    expect(structuredValuesOf(legacy).outage.areaCode).toBe('VILLAGE_WIDE');
    expect(structuredRequest('POWER_SCHEDULE', structuredValuesOf(legacy))).toEqual({
      powerSchedule: {
        outages: [
          {
            date: '2026-11-09',
            from: '08:00',
            to: '11:30',
            area: 'Xóm 2',
            areaCode: 'VILLAGE_WIDE',
          },
        ],
      },
    });
  });
});

describe('WorkshopEditor area select', () => {
  const client = (updateWorkshop = vi.fn(async () => WORKSHOP)) =>
    ({ updateWorkshop, addWorkshop: vi.fn() }) as unknown as StudioClient;

  it('starts unset, lists the hamlets, and saves the chosen code', async () => {
    const api = client();
    renderVi(<WorkshopEditor workshop={WORKSHOP} client={api} onSaved={async () => {}} />);
    const select = screen.getByLabelText(/Khu vực của xưởng/) as HTMLSelectElement;
    expect(select.value).toBe('');
    expect([...select.options].map((o) => o.textContent)).toEqual([
      'Chưa chọn khu vực',
      'Thôn Bát Tràng',
      'Thôn Giang Cao',
    ]);
    fireEvent.change(select, { target: { value: 'BAT_TRANG' } });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu' }));
    await waitFor(() =>
      expect(api.updateWorkshop).toHaveBeenCalledWith(
        WORKSHOP.id,
        WORKSHOP.version,
        expect.objectContaining({ areaCode: 'BAT_TRANG' }),
      ),
    );
  });

  it('shows the stored area and can clear it', async () => {
    const api = client();
    renderVi(
      <WorkshopEditor
        workshop={{ ...WORKSHOP, areaCode: 'GIANG_CAO' }}
        client={api}
        onSaved={async () => {}}
      />,
    );
    const select = screen.getByLabelText(/Khu vực của xưởng/) as HTMLSelectElement;
    expect(select.value).toBe('GIANG_CAO');
    fireEvent.change(select, { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu' }));
    await waitFor(() =>
      expect(api.updateWorkshop).toHaveBeenCalledWith(
        WORKSHOP.id,
        WORKSHOP.version,
        expect.objectContaining({ areaCode: null }),
      ),
    );
  });
});

describe('OutageBanner workshop area prompt', () => {
  const clientOf = (needsWorkshopArea: boolean) => ({
    todayOutages: vi.fn(async () => ({ date: '2026-11-09', outages: [], needsWorkshopArea })),
  });

  it('asks a household with no workshop area to set it, linking to the profile', async () => {
    renderVi(<OutageBanner client={clientOf(true) as never} />);
    const link = await screen.findByRole('link', { name: 'Chọn khu vực của xưởng' });
    expect(link.getAttribute('href')).toBe('/studio/ho-so');
    // Without cuts there is no outage alert.
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('shows no prompt once an area is set', async () => {
    const client = clientOf(false);
    const { container } = renderVi(<OutageBanner client={client as never} />);
    await waitFor(() => expect(client.todayOutages).toHaveBeenCalled());
    expect(container.textContent).toBe('');
  });
});
