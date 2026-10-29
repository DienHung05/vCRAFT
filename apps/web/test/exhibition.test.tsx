import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MakerCredits } from '@/features/exhibition/maker-credits';
import { VisitSection } from '@/features/exhibition/visit-section';
import { getArtisan, householdWorkshops } from '@/lib/demo/data';
import { renderVi } from './render';

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
