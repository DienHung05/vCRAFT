import { screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { VisitWorkshopView } from '@/features/catalog/view-models';
import { MakerCredits } from '@/features/exhibition/maker-credits';
import { VisitSection } from '@/features/exhibition/visit-section';
import { getArtisan, householdWorkshops } from '@/lib/demo/data';
import { renderVi } from './render';

// The mini map's pin cards link with next-intl, which needs the Next runtime; a plain <a> is enough here.
vi.mock('@/i18n/navigation', () => ({
  Link: ({ href, children }: { href: unknown; children: React.ReactNode }) => (
    <a href={typeof href === 'string' ? href : JSON.stringify(href)}>{children}</a>
  ),
}));

describe('ghi công người làm (vCRAFT-9hg.6)', () => {
  it('nêu tên từng người kèm phần việc; người đăng là ban điều hành hộ, không nằm trong danh sách', () => {
    renderVi(
      <MakerCredits
        household="Gốm Minh Hải"
        makers={[
          { name: 'Đỗ Văn Bình', detail: 'Vuốt dáng' },
          { name: 'Phạm Thị Lan', detail: 'Vẽ lam' },
        ]}
      />,
    );
    const list = screen.getByRole('list', { name: 'Người làm' });
    expect(
      within(list)
        .getAllByRole('listitem')
        .map((li) => li.textContent),
    ).toEqual(['Đỗ Văn BìnhVuốt dáng', 'Phạm Thị LanVẽ lam']);
    expect(within(list).queryByText(/ban điều hành/)).toBeNull();
    expect(screen.getByText(/do ban điều hành hộ Gốm Minh Hải đăng/)).toBeTruthy();
  });
});

describe('ghé thăm (vCRAFT-9hg.6)', () => {
  it('tách phòng trưng bày khỏi xưởng sản xuất; bản đồ luôn có danh sách chữ đi kèm', async () => {
    const artisan = await getArtisan('gom-minh-hai');
    if (!artisan) throw new Error('thiếu dữ liệu mẫu');
    renderVi(
      <VisitSection household={artisan.household} workshops={householdWorkshops(artisan)} />,
    );

    expect(
      within(screen.getByTestId('showrooms')).getByText('Phòng trưng bày Minh Hải'),
    ).toBeTruthy();
    const production = screen.getByTestId('production-workshops');
    expect(within(production).getByText('Lò nung Giang Cao')).toBeTruthy();
    expect(within(production).queryByText('Phòng trưng bày Minh Hải')).toBeNull();

    expect(screen.getByRole('figure', { name: 'Bản đồ làng' })).toBeTruthy();
    const places = within(screen.getByTestId('place-list')).getAllByRole('listitem');
    expect(places).toHaveLength(2);
    expect(places[0]?.textContent).toContain('đón khách');
    expect(places[1]?.textContent).toContain('sản xuất');
  });
});

describe('opening hours and status on the household page (FR-ART-05, BR-03)', () => {
  afterEach(() => vi.useRealTimers());

  const weekdays = [1, 2, 3, 4, 5].map((day) => ({ day, open: '08:00', close: '17:00' }));
  const showroom = (extra: Partial<VisitWorkshopView> = {}): VisitWorkshopView => ({
    id: 'w1',
    name: 'Phòng trưng bày',
    address: 'Xóm 2, Bát Tràng',
    purpose: 'SHOWROOM',
    acceptsVisitors: true,
    openingHours: weekdays,
    pin: { x: 50, y: 50 },
    ...extra,
  });
  // 2026-11-02 is a Monday in Vietnam (UTC+7).
  const at = (iso: string) => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(`${iso}+07:00`));
  };
  const status = () => screen.getByTestId('workshop-status').textContent;

  it('lists the weekly hours Monday first and marks days without hours as closed', () => {
    at('2026-11-02T10:00:00');
    renderVi(<VisitSection household="Gốm" workshops={[showroom()]} />);
    const rows = within(screen.getByTestId('weekly-hours')).getAllByRole('listitem');
    expect(rows.map((row) => row.textContent)).toEqual([
      'Thứ hai08:00 – 17:00',
      'Thứ ba08:00 – 17:00',
      'Thứ tư08:00 – 17:00',
      'Thứ năm08:00 – 17:00',
      'Thứ sáu08:00 – 17:00',
      'Thứ bảyNghỉ',
      'Chủ nhậtNghỉ',
    ]);
  });

  it('says "Đang mở cửa" inside the hours, in Vietnam time', () => {
    at('2026-11-02T10:00:00');
    renderVi(<VisitSection household="Gốm" workshops={[showroom()]} />);
    expect(status()).toBe('Đang mở cửa');
  });

  it('says "Đã đóng cửa" with the next opening outside the hours', () => {
    at('2026-11-02T20:00:00');
    renderVi(<VisitSection household="Gốm" workshops={[showroom()]} />);
    expect(status()).toBe('Đã đóng cửa · mở lại lúc 08:00, Thứ ba');
  });

  it('shows "Tạm đóng cửa" with the reason even inside the hours', () => {
    at('2026-11-02T10:00:00');
    renderVi(
      <VisitSection
        household="Gốm"
        workshops={[showroom({ temporarilyClosed: true, closureReason: 'Nghỉ Tết' })]}
      />,
    );
    expect(status()).toBe('Tạm đóng cửa: Nghỉ Tết');
  });

  it('shows the experience offer with duration and price', () => {
    at('2026-11-02T10:00:00');
    renderVi(
      <VisitSection
        household="Gốm"
        workshops={[
          showroom({
            experience: {
              description: 'Nặn gốm cùng nghệ nhân',
              durationMinutes: 90,
              priceVnd: 250000,
            },
          }),
        ]}
      />,
    );
    const offer = screen.getByTestId('workshop-experience');
    expect(within(offer).getByText('Nặn gốm cùng nghệ nhân')).toBeTruthy();
    expect(offer.textContent).toContain('90 phút');
    expect(offer.textContent).toMatch(/250\.000/);
  });
});
