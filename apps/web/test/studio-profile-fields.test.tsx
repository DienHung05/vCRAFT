import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { ApiError, type StudioClient } from '@vcraft/api-client';
import type { HouseholdDto } from '@vcraft/contracts';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProfileEditor } from '@/features/studio/profile-editor';
import { renderVi } from './render';

vi.mock('next/dynamic', () => ({ default: () => () => null }));
vi.mock('@/lib/notify', () => ({
  notify: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));
vi.mock('@/i18n/navigation', () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a href="/x">{children}</a>,
  usePathname: () => '/studio',
}));

const HOUSEHOLD: HouseholdDto = {
  id: '00000000-0000-4000-8000-000000000001',
  version: 3,
  name: 'Gốm Minh Hải',
  slug: 'gom-minh-hai',
  history: 'Câu chuyện.',
  village: 'Bát Tràng',
  craft: 'men lam',
  craftCategory: 'MEN',
  coverUrl: null,
  coverVariants: [],
  ratingAverage: null,
  ratingCount: 0,
  portrait: null,
  banner: null,
  seal: null,
  coverPhoto: null,
  portraitPhoto: null,
  sealPhoto: null,
  foundedYear: null,
  generations: null,
  timeline: [],
  certifications: [
    { name: 'OCOP', issuer: 'UBND', year: 2023, issuedOn: null, photo: null, verified: true },
  ],
  gallery: [
    {
      mediaId: null,
      url: '/images/demo/a.webp',
      variants: [],
      alt: 'Ảnh thứ nhất',
      altEn: null,
      caption: null,
      credit: null,
    },
    {
      mediaId: null,
      url: '/images/demo/b.webp',
      variants: [],
      alt: 'Ảnh thứ hai',
      altEn: null,
      caption: null,
      credit: null,
    },
  ],
  capacityByCategory: {},
  artisans: [],
  workshops: [],
  visit: { showrooms: [], productionWorkshops: [] },
  products: [],
  status: 'APPROVED',
  statusReason: null,
  reviewState: 'NEW',
  resubmittedAt: null,
  approvedAt: null,
  idNumberMasked: null,
  completeness: { percent: 25, missing: [] },
};

function fakeClient(overrides: Partial<StudioClient> = {}): StudioClient {
  return {
    getHousehold: vi.fn(async () => HOUSEHOLD),
    updateProfile: vi.fn(async () => HOUSEHOLD),
    slugAvailability: vi.fn(async () => ({ available: true })),
    storySuggestion: vi.fn(),
    ...overrides,
  } as unknown as StudioClient;
}

beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }));
afterEach(() => vi.useRealTimers());

const settle = () => act(async () => {});

/** The save button of the card with this heading. */
const saveOf = (heading: string) =>
  within(screen.getByRole('heading', { name: heading }).parentElement as HTMLElement).getByRole(
    'button',
    { name: 'Lưu' },
  ) as HTMLButtonElement;

describe('craft category (FR-ART-01)', () => {
  it('shows a select with the fixed list and saves category and detail', async () => {
    const client = fakeClient();
    renderVi(<ProfileEditor client={client} />);
    const select = (await screen.findByLabelText('Nhóm nghề')) as HTMLSelectElement;
    expect(select.value).toBe('MEN');
    expect([...select.options].map((o) => o.textContent)).toEqual([
      'Chọn nhóm nghề',
      'Gốm sứ',
      'Men gốm',
      'Vẽ gốm',
      'Nung lò',
      'Khác',
    ]);
    fireEvent.change(select, { target: { value: 'VE_GOM' } });
    fireEvent.change(screen.getByLabelText('Chi tiết nghề (tùy chọn)'), {
      target: { value: 'vẽ hoa sen' },
    });
    fireEvent.click(screen.getAllByRole('button', { name: 'Lưu' })[0] as HTMLElement);
    await waitFor(() =>
      expect(client.updateProfile).toHaveBeenCalledWith(
        3,
        expect.objectContaining({ craft: 'vẽ hoa sen', craftCategory: 'VE_GOM' }),
      ),
    );
  });
});

describe('slug field (FR-ART-01)', () => {
  it('does not ask while the address is the household’s own, then checks 300 ms after typing', async () => {
    const slugAvailability = vi.fn(async () => ({ available: false, suggestion: 'lo-duc-phat-2' }));
    renderVi(<ProfileEditor client={fakeClient({ slugAvailability })} />);
    const input = (await screen.findByLabelText('Địa chỉ trang')) as HTMLInputElement;
    expect(input.value).toBe('gom-minh-hai');
    await settle();
    expect(slugAvailability).not.toHaveBeenCalled();

    fireEvent.change(input, { target: { value: 'lo-duc-phat' } });
    expect(screen.getByText(/Đường dẫn cũ vẫn tự chuyển|đường dẫn cũ vẫn tự chuyển/)).toBeTruthy();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(150);
    });
    expect(slugAvailability).not.toHaveBeenCalled();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(200);
    });
    expect(slugAvailability).toHaveBeenCalledWith('lo-duc-phat');
    expect(await screen.findByText(/Thử “lo-duc-phat-2”/)).toBeTruthy();
  });

  it('suggests the address from the Vietnamese name and saves only the slug', async () => {
    const client = fakeClient();
    renderVi(<ProfileEditor client={client} />);
    const input = (await screen.findByLabelText('Địa chỉ trang')) as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'x' } });
    fireEvent.click(screen.getByRole('button', { name: 'Gợi ý theo tên hộ' }));
    expect(input.value).toBe('gom-minh-hai');

    fireEvent.change(input, { target: { value: 'gom-minh-hai-moi' } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });
    expect(await screen.findByText('Địa chỉ này dùng được.')).toBeTruthy();
    fireEvent.click(saveOf('Địa chỉ trang công khai'));
    await waitFor(() =>
      expect(client.updateProfile).toHaveBeenCalledWith(3, { slug: 'gom-minh-hai-moi' }),
    );
  });

  it('shows a duplicate answer from the save itself without a stale-version reload', async () => {
    const updateProfile = vi.fn(async () => {
      throw new ApiError('CONFLICT_DUPLICATE', 409);
    });
    const getHousehold = vi.fn(async () => HOUSEHOLD);
    renderVi(<ProfileEditor client={fakeClient({ updateProfile, getHousehold })} />);
    const input = await screen.findByLabelText('Địa chỉ trang');
    fireEvent.change(input, { target: { value: 'da-co-nguoi-dung' } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });
    fireEvent.click(saveOf('Địa chỉ trang công khai'));
    expect(await screen.findByText(/vừa có người dùng/)).toBeTruthy();
    expect(getHousehold).toHaveBeenCalledTimes(1);
  });
});

describe('stale version and failed refresh', () => {
  it('after a 409 the section draft shows the server value and the message asks to re-enter', async () => {
    const getHousehold = vi
      .fn()
      .mockResolvedValueOnce(HOUSEHOLD)
      .mockResolvedValue({ ...HOUSEHOLD, version: 4, slug: 'ban-cua-nguoi-khac' });
    const updateProfile = vi.fn(async () => {
      throw new ApiError('STALE_VERSION', 409);
    });
    renderVi(<ProfileEditor client={fakeClient({ getHousehold, updateProfile })} />);
    const input = (await screen.findByLabelText('Địa chỉ trang')) as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'ban-cua-toi' } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });
    fireEvent.click(saveOf('Địa chỉ trang công khai'));
    expect(await screen.findByText(/nhập lại thay đổi chưa lưu/)).toBeTruthy();
    await waitFor(() =>
      expect((screen.getByLabelText('Địa chỉ trang') as HTMLInputElement).value).toBe(
        'ban-cua-nguoi-khac',
      ),
    );
  });

  it('keeps the screen and shows a notice when a refresh fails after data is loaded', async () => {
    const getHousehold = vi
      .fn()
      .mockResolvedValueOnce(HOUSEHOLD)
      .mockRejectedValue(new ApiError('SERVICE_UNAVAILABLE', 500));
    const updateProfile = vi.fn(async () => HOUSEHOLD);
    renderVi(<ProfileEditor client={fakeClient({ getHousehold, updateProfile })} />);
    const input = (await screen.findByLabelText('Địa chỉ trang')) as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'ban-cua-toi' } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });
    fireEvent.click(saveOf('Địa chỉ trang công khai'));
    expect(await screen.findByText(/Chưa làm mới được dữ liệu/)).toBeTruthy();
    expect(screen.getByLabelText('Địa chỉ trang')).toBeTruthy();
    expect(screen.queryByText(/Chưa tải được dữ liệu của hộ/)).toBeNull();
  });
});

describe('cover, portrait and seal (FR-ART-01)', () => {
  it('requires a description for the cover but not for the seal, and saves media references', async () => {
    const client = fakeClient();
    renderVi(
      <ProfileEditor
        client={fakeClient({
          ...client,
          getHousehold: vi.fn(async () => ({
            ...HOUSEHOLD,
            coverPhoto: { mediaId: 'cover-1', url: null, variants: [], alt: '' },
            sealPhoto: { mediaId: 'seal-1', url: null, variants: [], alt: '' },
          })),
          updateProfile: client.updateProfile,
        })}
      />,
    );
    const cover = await screen.findByTestId('photo-coverPhoto');
    const save = saveOf('Ảnh bìa, chân dung và con dấu');
    expect(save.disabled).toBe(true);
    expect(screen.getAllByText('Mỗi ảnh cần có mô tả ít nhất 3 ký tự.').length).toBeGreaterThan(0);

    fireEvent.change(within(cover).getByLabelText('Mô tả ảnh (bắt buộc)'), {
      target: { value: 'Cổng xưởng gốm' },
    });
    expect(save.disabled).toBe(false);
    fireEvent.click(save);
    await waitFor(() =>
      expect(client.updateProfile).toHaveBeenCalledWith(3, {
        coverPhoto: { mediaId: 'cover-1', alt: 'Cổng xưởng gốm' },
        portraitPhoto: null,
        sealPhoto: { mediaId: 'seal-1', alt: '' },
      }),
    );
  });

  it('removes a photo', async () => {
    const client = fakeClient({
      getHousehold: vi.fn(async () => ({
        ...HOUSEHOLD,
        portraitPhoto: { mediaId: 'p-1', url: 'https://cdn/p.webp', variants: [], alt: 'Bác Hải' },
      })),
    });
    renderVi(<ProfileEditor client={client} />);
    const portrait = await screen.findByTestId('photo-portraitPhoto');
    fireEvent.click(within(portrait).getByRole('button', { name: /Bỏ ảnh/ }));
    expect(within(portrait).getByText('Chưa có ảnh')).toBeTruthy();
    fireEvent.click(saveOf('Ảnh bìa, chân dung và con dấu'));
    await waitFor(() =>
      expect(client.updateProfile).toHaveBeenCalledWith(
        3,
        expect.objectContaining({ portraitPhoto: null }),
      ),
    );
  });
});

describe('certifications (FR-ART-03)', () => {
  it('sends a date for new entries, keeps the legacy year, and drops the verified badge on edit', async () => {
    const client = fakeClient();
    renderVi(<ProfileEditor client={client} />);
    expect(await screen.findByText('Mới ghi năm 2023. Nhập ngày cấp để đầy đủ hơn.')).toBeTruthy();
    expect(screen.getByText('Đã xác minh')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Tên chứng nhận'), { target: { value: 'OCOP 4 sao' } });
    expect(screen.queryByText('Đã xác minh')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Thêm chứng nhận' }));
    const save = saveOf('Chứng nhận');
    expect(save.disabled).toBe(true);
    const names = screen.getAllByLabelText('Tên chứng nhận');
    fireEvent.change(names[1] as HTMLElement, { target: { value: 'ISO 9001' } });
    fireEvent.change(screen.getAllByLabelText('Đơn vị cấp')[1] as HTMLElement, {
      target: { value: 'BSI' },
    });
    fireEvent.change(screen.getAllByLabelText('Ngày cấp')[1] as HTMLElement, {
      target: { value: '2024-05-06' },
    });
    expect(save.disabled).toBe(false);
    fireEvent.click(save);
    await waitFor(() =>
      expect(client.updateProfile).toHaveBeenCalledWith(3, {
        certifications: [
          { name: 'OCOP 4 sao', issuer: 'UBND', year: 2023, photo: null },
          { name: 'ISO 9001', issuer: 'BSI', issuedOn: '2024-05-06', photo: null },
        ],
      }),
    );
  });
});

describe('workshop gallery order (FR-ART-04)', () => {
  const order = () =>
    within(screen.getByTestId('gallery-rows'))
      .getAllByLabelText('Mô tả ảnh (bắt buộc)')
      .map((input) => (input as HTMLInputElement).value);

  it('moves a photo with the keyboard-accessible buttons and saves the new order', async () => {
    const client = fakeClient();
    renderVi(<ProfileEditor client={client} />);
    await screen.findByTestId('gallery-rows');
    expect(order()).toEqual(['Ảnh thứ nhất', 'Ảnh thứ hai']);
    expect(
      (screen.getByRole('button', { name: 'Đưa ảnh 1 lên trước' }) as HTMLButtonElement).disabled,
    ).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: 'Đưa ảnh 2 lên trước' }));
    expect(order()).toEqual(['Ảnh thứ hai', 'Ảnh thứ nhất']);
    expect(screen.getByText('Ảnh đã chuyển sang vị trí 1 trên 2.')).toBeTruthy();

    fireEvent.click(saveOf('Ảnh xưởng'));
    await waitFor(() =>
      expect(client.updateProfile).toHaveBeenCalledWith(3, {
        gallery: [
          { url: '/images/demo/b.webp', alt: 'Ảnh thứ hai' },
          { url: '/images/demo/a.webp', alt: 'Ảnh thứ nhất' },
        ],
      }),
    );
  });

  it('offers a drag handle per photo', async () => {
    renderVi(<ProfileEditor client={fakeClient()} />);
    await screen.findByTestId('gallery-rows');
    expect(screen.getByRole('button', { name: 'Kéo để đổi vị trí ảnh 1' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Kéo để đổi vị trí ảnh 2' })).toBeTruthy();
  });
});

describe('story editor (FR-ART-01)', () => {
  it('formats the selection as bold, a bulleted list and a link, and previews it safely', async () => {
    const client = fakeClient();
    renderVi(<ProfileEditor client={client} />);
    const area = (await screen.findByLabelText('Câu chuyện của hộ')) as HTMLTextAreaElement;
    fireEvent.change(area, { target: { value: 'Men lam' } });
    area.setSelectionRange(0, 3);
    fireEvent.click(screen.getByRole('button', { name: 'Đậm' }));
    expect(area.value).toBe('**Men** lam');

    area.setSelectionRange(0, area.value.length);
    fireEvent.click(screen.getByRole('button', { name: 'Danh sách' }));
    expect(area.value).toBe('- **Men** lam');

    area.setSelectionRange(area.value.length, area.value.length);
    fireEvent.click(screen.getByRole('button', { name: 'Liên kết' }));
    fireEvent.change(screen.getByLabelText('Địa chỉ liên kết (https://…)'), {
      target: { value: 'javascript:alert(1)' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Chèn liên kết' }));
    expect(await screen.findByText(/phải bắt đầu bằng https/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Địa chỉ liên kết (https://…)'), {
      target: { value: 'https://example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Chèn liên kết' }));
    expect(area.value).toBe('- **Men** lam[chữ hiện ra](https://example.com)');

    const preview = screen.getByRole('region', { name: 'Xem trước' });
    expect(preview.querySelector('li strong')?.textContent).toBe('Men');
    const link = preview.querySelector('a');
    expect(link?.getAttribute('href')).toBe('https://example.com');
    expect(link?.getAttribute('rel')).toBe('noopener nofollow');
  });

  it('never renders typed HTML', async () => {
    renderVi(<ProfileEditor client={fakeClient()} />);
    const area = await screen.findByLabelText('Câu chuyện của hộ');
    fireEvent.change(area, {
      target: { value: '<img src=x onerror=alert(1)> <script>x</script>' },
    });
    const preview = screen.getByRole('region', { name: 'Xem trước' });
    expect(preview.querySelector('img, script')).toBeNull();
    expect(preview.textContent).toContain('<img src=x onerror=alert(1)>');
  });
});

describe('AI story suggestion (FR-ART-08)', () => {
  it('shows the suggestion and its translation in a dialog and inserts it only on request', async () => {
    const storySuggestion = vi.fn(async () => ({
      vi: 'Gốm men lam ba đời.',
      en: 'Three generations of blue-glaze pottery.',
    }));
    const client = fakeClient({ storySuggestion });
    renderVi(<ProfileEditor client={client} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Gợi ý câu chuyện bằng AI' }));
    expect(await screen.findByText('Gốm men lam ba đời.', {}, { timeout: 3000 })).toBeTruthy();
    expect(screen.getByText('Three generations of blue-glaze pottery.')).toBeTruthy();
    expect(client.updateProfile).not.toHaveBeenCalled();

    await waitFor(() => expect(document.querySelector('dialog')?.open).toBe(true));
    fireEvent.click(screen.getByRole('button', { name: 'Chèn vào cuối câu chuyện' }));
    expect((screen.getByLabelText('Câu chuyện của hộ') as HTMLTextAreaElement).value).toBe(
      'Câu chuyện.\n\nGốm men lam ba đời.',
    );
    expect(client.updateProfile).not.toHaveBeenCalled();
  });

  it('disables the button after a 503 because the model is not configured', async () => {
    const storySuggestion = vi.fn(async () => {
      throw new ApiError('SERVICE_UNAVAILABLE', 503);
    });
    renderVi(<ProfileEditor client={fakeClient({ storySuggestion })} />);
    const button = (await screen.findByRole('button', {
      name: 'Gợi ý câu chuyện bằng AI',
    })) as HTMLButtonElement;
    fireEvent.click(button);
    expect(await screen.findByText(/chưa bật trên hệ thống này/)).toBeTruthy();
    expect(button.disabled).toBe(true);
  });
});
