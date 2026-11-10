import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import type { MapPinDto } from '@vcraft/contracts';
import type { CraftCategory } from '@vcraft/domain';
import { describe, expect, it, vi } from 'vitest';
import {
  craftsOf,
  distanceKm,
  filterPins,
  inBounds,
  sortByDistance,
  toFeatureCollection,
} from '@/features/village-map/map-model';
import { VillageMapExplorer } from '@/features/village-map/village-map-explorer';
import { renderVi } from './render';

vi.mock('@/i18n/navigation', () => ({
  Link: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <a href="/x" className={className}>
      {children}
    </a>
  ),
}));

const HOURS = [1, 2, 3, 4, 5].map((day) => ({ day, open: '08:00', close: '17:00' }));

function pin(id: string, overrides: Partial<MapPinDto> = {}, craft = 'men lam'): MapPinDto {
  return {
    workshopId: `00000000-0000-4000-8000-00000000000${id}`,
    workshopName: `Xưởng ${id}`,
    address: 'Bát Tràng',
    purpose: 'SHOWROOM',
    visitable: true,
    visitingInfo: null,
    openingHours: HOURS,
    experience: null,
    temporarilyClosed: false,
    closureReason: null,
    lat: 20.97,
    lng: 105.91,
    household: { name: `Hộ ${id}`, slug: `ho-${id}`, craft, craftCategory: null, coverUrl: null },
    ...overrides,
  };
}

function withCategory(p: MapPinDto, craftCategory: CraftCategory): MapPinDto {
  return { ...p, household: { ...p.household, craftCategory } };
}

// Thứ hai 10:00 giờ Việt Nam
const MONDAY = new Date('2026-11-02T10:00:00+07:00');
const SUNDAY = new Date('2026-11-01T10:00:00+07:00');
const NO_FILTER = { openNow: false, visitable: false, experience: false, craft: '' };

describe('map-model', () => {
  const pins = [
    pin('1'),
    pin('2', { visitable: false, purpose: 'PRODUCTION', openingHours: null }),
    pin('3', { openingHours: null }, 'men ngọc'),
  ];

  it('lọc đang mở, đón khách và theo nghề', () => {
    const ids = (filters: Parameters<typeof filterPins>[1], now = MONDAY) =>
      filterPins(pins, filters, now).map((p) => p.workshopName);
    expect(ids(NO_FILTER)).toEqual(['Xưởng 1', 'Xưởng 2', 'Xưởng 3']);
    expect(ids({ ...NO_FILTER, openNow: true })).toEqual(['Xưởng 1']);
    expect(ids({ ...NO_FILTER, openNow: true }, SUNDAY)).toEqual([]);
    expect(ids({ ...NO_FILTER, visitable: true })).toEqual(['Xưởng 1', 'Xưởng 3']);
    expect(ids({ ...NO_FILTER, craft: 'men ngọc' })).toEqual(['Xưởng 3']);
  });

  it('filters workshops that offer an experience (FR-MAP-03)', () => {
    const experience = {
      description: 'Nặn gốm cùng nghệ nhân',
      durationMinutes: 90,
      priceVnd: 250000,
    };
    const withExperience = [pin('1', { experience }), pin('2'), pin('3', { experience })];
    expect(
      filterPins(withExperience, { ...NO_FILTER, experience: true }, MONDAY).map(
        (p) => p.workshopName,
      ),
    ).toEqual(['Xưởng 1', 'Xưởng 3']);
    expect(filterPins(withExperience, NO_FILTER, MONDAY)).toHaveLength(3);
  });

  it('a temporarily closed workshop never matches the open-now filter (BR-03)', () => {
    const closed = pin('1', { temporarilyClosed: true, closureReason: 'Nghỉ Tết' });
    expect(filterPins([closed, pin('2')], { ...NO_FILTER, openNow: true }, MONDAY)).toEqual([
      pin('2'),
    ]);
    expect(toFeatureCollection([closed], MONDAY).features[0]?.properties.status).toBe('closed');
  });

  it('lists free-text crafts only for pins without a category, without duplicates', () => {
    expect(craftsOf(pins)).toEqual([
      { value: 'men lam', category: null },
      { value: 'men ngọc', category: null },
    ]);
  });

  it('groups by craft category in domain order, with free text of uncategorised pins last', () => {
    const mixed = [
      withCategory(pin('1', {}, 'gốm men rạn'), 'VE_GOM'),
      withCategory(pin('2', {}, 'gốm sứ'), 'GOM_SU'),
      withCategory(pin('3', {}, 'gốm sứ cao cấp'), 'GOM_SU'),
      pin('4', {}, 'đồ thủ công'),
    ];
    expect(craftsOf(mixed)).toEqual([
      { value: 'GOM_SU', category: 'GOM_SU' },
      { value: 'VE_GOM', category: 'VE_GOM' },
      { value: 'đồ thủ công', category: null },
    ]);
  });

  it('filters by category code, and still by an old free-text value', () => {
    const mixed = [
      withCategory(pin('1', {}, 'gốm men rạn'), 'GOM_SU'),
      withCategory(pin('2', {}, 'gốm sứ'), 'GOM_SU'),
      withCategory(pin('3', {}, 'men ngọc'), 'MEN'),
      pin('4', {}, 'đồ thủ công'),
    ];
    const names = (craft: string) =>
      filterPins(mixed, { ...NO_FILTER, craft }, MONDAY).map((p) => p.workshopName);
    expect(names('GOM_SU')).toEqual(['Xưởng 1', 'Xưởng 2']);
    expect(names('men ngọc')).toEqual(['Xưởng 3']);
    expect(names('đồ thủ công')).toEqual(['Xưởng 4']);
  });

  it('sắp theo khoảng cách và kiểm tra trong khung nhìn', () => {
    const near = pin('1', { lat: 20.98, lng: 105.91 });
    const far = pin('2', { lat: 21.2, lng: 105.91 });
    const origin = { lat: 20.97, lng: 105.91 };
    expect(sortByDistance([far, near], origin)).toEqual([near, far]);
    expect(distanceKm(origin, near)).toBeCloseTo(1.11, 1);
    const box = { west: 105.9, east: 105.92, south: 20.96, north: 21 };
    expect(inBounds(near, box)).toBe(true);
    expect(inBounds(far, box)).toBe(false);
  });

  it('GeoJSON mang cờ đang mở cho lớp nhịp thở', () => {
    const { features } = toFeatureCollection([pin('1')], MONDAY);
    expect(features[0]?.properties.open).toBe(true);
    expect(features[0]?.geometry.coordinates).toEqual([105.91, 20.97]);
  });
});

describe('VillageMapExplorer', () => {
  const pins = [pin('1'), pin('3', {}, 'men ngọc')];

  it('không có WebGL thì báo và vẫn hiện đầy đủ danh sách chữ (FR-MAP-07)', async () => {
    renderVi(<VillageMapExplorer pins={pins} />);
    await waitFor(() => expect(screen.getByRole('status').textContent).toMatch(/WebGL/));
    expect(screen.queryByTestId('map-frame')).toBeNull();
    const list = screen.getByTestId('workshop-list');
    expect(within(list).getAllByRole('listitem')).toHaveLength(2);
  });

  it('lọc theo nghề cập nhật danh sách', () => {
    renderVi(<VillageMapExplorer pins={pins} />);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'men ngọc' } });
    const list = screen.getByTestId('workshop-list');
    expect(within(list).getAllByRole('listitem')).toHaveLength(1);
    expect(within(list).getByText('Hộ 3')).toBeTruthy();
  });

  it('shows translated category labels in the craft filter and filters by them', () => {
    renderVi(
      <VillageMapExplorer
        pins={[
          withCategory(pin('1', {}, 'gốm men rạn'), 'GOM_SU'),
          withCategory(pin('2', {}, 'men ngọc'), 'MEN'),
          pin('3', {}, 'đồ thủ công'),
        ]}
      />,
    );
    const select = screen.getByRole('combobox');
    const labels = within(select)
      .getAllByRole('option')
      .map((o) => o.textContent);
    expect(labels).toEqual(['Mọi nghề', 'Gốm sứ', 'Men gốm', 'đồ thủ công']);
    fireEvent.change(select, { target: { value: 'MEN' } });
    const list = screen.getByTestId('workshop-list');
    expect(within(list).getAllByRole('listitem')).toHaveLength(1);
    expect(within(list).getByText('Hộ 2')).toBeTruthy();
  });

  it('lists the experience and the closure reason, and the experience filter narrows the list', () => {
    const experience = {
      description: 'Nặn gốm cùng nghệ nhân',
      durationMinutes: 90,
      priceVnd: 250000,
    };
    renderVi(
      <VillageMapExplorer
        pins={[
          pin('1', { experience }),
          pin('3', { temporarilyClosed: true, closureReason: 'Nghỉ Tết' }),
        ]}
      />,
    );
    const list = screen.getByTestId('workshop-list');
    expect(within(list).getByText(/Có trải nghiệm · 90 phút/)).toBeTruthy();
    expect(within(list).getByText('Tạm đóng cửa: Nghỉ Tết')).toBeTruthy();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Có trải nghiệm' }));
    expect(within(list).getAllByRole('listitem')).toHaveLength(1);
    expect(within(list).getByText('Hộ 1')).toBeTruthy();
  });

  it('không xưởng nào khớp thì hiện trạng thái trống', () => {
    renderVi(<VillageMapExplorer pins={[pin('2', { visitable: false })]} />);
    fireEvent.click(screen.getByRole('checkbox', { name: /Đón khách/ }));
    expect(screen.getByText(/Không có xưởng nào khớp/)).toBeTruthy();
  });
});
