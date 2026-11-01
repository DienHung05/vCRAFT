import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { ApiError, type StudioClient } from '@vcraft/api-client';
import type { HouseholdDto, JournalDto, ProductDto } from '@vcraft/contracts';
import { describe, expect, it, vi } from 'vitest';
import {
  exifFields,
  isOldPhoto,
  JournalEditor,
  journalImageOf,
  noteWithTime,
} from '@/features/studio/journal-editor';
import { ProductEditor, toProductUpdate } from '@/features/studio/product-editor';
import { EMPTY_PRODUCT, parseNewProduct } from '@/features/studio/product-fields';
import { ProductList } from '@/features/studio/product-list';
import { confirmDialog } from './confirm';
import { renderVi } from './render';

const push = vi.fn();
vi.mock('@/i18n/navigation', () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a href="/x">{children}</a>,
  usePathname: () => '/studio/san-pham',
  useRouter: () => ({ push }),
}));
vi.mock('@/features/traceability/trace-qr', () => ({ TraceQr: () => <div data-testid="qr" /> }));

const ID = '00000000-0000-4000-8000-00000000000';

function product(n: number, overrides: Partial<ProductDto> = {}): ProductDto {
  return {
    id: `${ID}${n}`,
    version: 2,
    name: `Món ${n}`,
    slug: `mon-${n}`,
    traceCode: `CODE000${n}`,
    description: '',
    kind: 'OBJECT',
    batchSize: null,
    category: 'VASE',
    priceVnd: 100_000,
    stock: 1,
    material: null,
    dimensions: null,
    weightGrams: null,
    artisanNote: null,
    coverUrl: null,
    coverAlt: null,
    images: [],
    status: 'DRAFT',
    publishedAt: null,
    makers: [],
    postedBy: 'HOUSEHOLD_ADMINISTRATION',
    ...overrides,
  };
}

const HOUSEHOLD = {
  id: `${ID}9`,
  version: 1,
  name: 'Hộ',
  slug: 'ho',
  status: 'APPROVED',
  artisans: [{ id: `${ID}8`, version: 1, name: 'Bình', craftRole: null, bio: null }],
  products: [
    product(1),
    product(2, { status: 'PUBLISHED', publishedAt: '2026-09-01T00:00:00.000Z' }),
    product(3, { status: 'WITHDRAWN', publishedAt: '2026-09-01T00:00:00.000Z' }),
  ],
} as unknown as HouseholdDto;

const ENTRY = {
  id: `${ID}5`,
  version: 1,
  seq: 0,
  stage: 'clay' as const,
  declaredDate: '2026-09-01',
  note: 'Nhào đất',
  images: [],
  skipReason: null,
  supersedesSeq: null,
  supersededBySeq: null,
  recordedAt: '2026-09-01T00:00:00.000Z',
  prevHash: 'GENESIS',
  hash: 'a'.repeat(64),
};
const JOURNAL: JournalDto = {
  productId: `${ID}1`,
  entries: [ENTRY],
  inProgress: true,
  missingStages: [],
};

function client(overrides: Partial<StudioClient> = {}): StudioClient {
  return {
    getHousehold: vi.fn(async () => HOUSEHOLD),
    getJournal: vi.fn(async () => JOURNAL),
    appendJournalEntry: vi.fn(async () => JOURNAL),
    deleteJournalEntry: vi.fn(async () => ({ ...JOURNAL, entries: [] })),
    publishProduct: vi.fn(async () => product(1)),
    withdrawProduct: vi.fn(async () => product(2)),
    updateProduct: vi.fn(async () => product(1)),
    setMakers: vi.fn(async () => product(1)),
    addArtisan: vi.fn(),
    recordConsent: vi.fn().mockResolvedValue({}),
    ...overrides,
  } as unknown as StudioClient;
}

describe('ProductList', () => {
  it('lọc nháp, đang trưng bày, đã rút', async () => {
    renderVi(<ProductList client={client()} />);
    const list = await screen.findByTestId('studio-products');
    expect(within(list).getAllByRole('listitem')).toHaveLength(3);
    fireEvent.click(screen.getByRole('radio', { name: 'Đã rút' }));
    expect(within(screen.getByTestId('studio-products')).getByText('Món 3')).toBeTruthy();
    expect(screen.queryByText('Món 1')).toBeNull();
  });
});

describe('biểu mẫu sản phẩm', () => {
  it('lô phải có cỡ lô; vật đơn chiếc thì không', () => {
    expect(parseNewProduct({ ...EMPTY_PRODUCT, name: 'Bình' }).success).toBe(true);
    expect(parseNewProduct({ ...EMPTY_PRODUCT, name: 'Bình', kind: 'BATCH' }).success).toBe(false);
    expect(
      parseNewProduct({ ...EMPTY_PRODUCT, name: 'Bình', kind: 'BATCH', batchSize: '40' }).data,
    ).toMatchObject({ kind: 'BATCH', batchSize: 40 });
    expect(parseNewProduct(EMPTY_PRODUCT).success).toBe(false);
  });

  it('đổi biểu mẫu sang yêu cầu cập nhật', () => {
    expect(
      toProductUpdate({ ...EMPTY_PRODUCT, name: ' Bình ', priceVnd: '500000', weightGrams: '' }),
    ).toMatchObject({ name: 'Bình', priceVnd: 500_000, weightGrams: null });
  });
});

describe('ProductEditor', () => {
  it('xuất bản bản nháp với phiên bản đang xem; sản phẩm đã rút thì xuất bản lại', async () => {
    const api = client();
    const first = renderVi(<ProductEditor productId={`${ID}1`} client={api} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Xuất bản' }));
    expect(api.publishProduct).not.toHaveBeenCalled();
    confirmDialog('Xuất bản');
    await waitFor(() => expect(api.publishProduct).toHaveBeenCalledWith(`${ID}1`, 2, false));
    first.unmount();

    renderVi(<ProductEditor productId={`${ID}3`} client={api} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Xuất bản lại' }));
    confirmDialog('Xuất bản lại');
    await waitFor(() => expect(api.publishProduct).toHaveBeenCalledWith(`${ID}3`, 2, true));
  });

  it('rút cần lý do', async () => {
    const api = client();
    renderVi(<ProductEditor productId={`${ID}2`} client={api} />);
    const withdraw = await screen.findByRole('button', { name: 'Rút khỏi trưng bày' });
    expect((withdraw as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('Lý do rút'), { target: { value: 'Hết hàng' } });
    fireEvent.click(withdraw);
    confirmDialog('Rút khỏi trưng bày');
    await waitFor(() => expect(api.withdrawProduct).toHaveBeenCalledWith(`${ID}2`, 2, 'Hết hàng'));
  });

  it('ghi công người làm theo phần việc; có QR và nút tải PNG', async () => {
    const api = client();
    renderVi(<ProductEditor productId={`${ID}1`} client={api} />);
    fireEvent.change(await screen.findByLabelText('Phần việc của Bình'), {
      target: { value: 'Vuốt dáng' },
    });
    const section = screen.getByRole('heading', { name: 'Người làm' }).parentElement as HTMLElement;
    fireEvent.click(within(section).getByRole('button', { name: 'Lưu' }));
    await waitFor(() =>
      expect(api.setMakers).toHaveBeenCalledWith(`${ID}1`, {
        makers: [{ artisanId: `${ID}8`, contribution: 'Vuốt dáng' }],
      }),
    );
    expect(screen.getByTestId('qr')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Tải PNG' })).toBeTruthy();
  });

  it('records the maker consent on the server before adding a person', async () => {
    const api = client({ addArtisan: vi.fn(async () => ({})) as never });
    renderVi(<ProductEditor productId={`${ID}1`} client={api} />);
    fireEvent.change(await screen.findByLabelText('Tên người làm mới'), {
      target: { value: 'Lan' },
    });
    const add = screen.getByRole('button', { name: 'Thêm người làm' });
    expect((add as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole('checkbox', { name: /Chính sách quyền riêng tư/ }));
    fireEvent.click(add);
    await waitFor(() => expect(api.addArtisan).toHaveBeenCalledWith({ name: 'Lan' }));
    expect(api.recordConsent).toHaveBeenCalledWith('MAKER_PROFILE', '2026-11-01');
    expect(vi.mocked(api.recordConsent).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(api.addArtisan).mock.invocationCallOrder[0] ?? 0,
    );
  });

  it('sản phẩm của hộ khác không mở được', async () => {
    renderVi(<ProductEditor productId={`${ID}7`} client={client()} />);
    expect(await screen.findByText(/không tìm thấy|Không tìm thấy/)).toBeTruthy();
  });

  it('bản cũ (409) tải lại và báo', async () => {
    const api = client({
      updateProduct: vi.fn(async () => {
        throw new ApiError('STALE_VERSION', 409);
      }),
    });
    renderVi(<ProductEditor productId={`${ID}1`} client={api} />);
    const section = (await screen.findByRole('heading', { name: 'Thông tin' }))
      .parentElement as HTMLElement;
    fireEvent.click(within(section).getByRole('button', { name: 'Lưu' }));
    expect(await within(section).findByText(/vừa được sửa ở nơi khác/)).toBeTruthy();
  });
});

describe('JournalEditor', () => {
  it('nạp mẫu công đoạn theo danh mục; đề xuất công đoạn kế tiếp', async () => {
    const api = client();
    renderVi(<JournalEditor productId={`${ID}1`} client={api} />);
    const template = await screen.findByTestId('stage-template');
    expect(within(template).getAllByRole('listitem')).toHaveLength(7);
    expect(within(template).getByText(/Nhào đất · đã ghi/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Thêm mốc' }));
    const form = screen.getByTestId('journal-form');
    expect((within(form).getByLabelText('Công đoạn') as HTMLSelectElement).value).toBe('throw');
    const file = within(form).getByLabelText('Ảnh công đoạn') as HTMLInputElement;
    expect(file.getAttribute('capture')).toBe('environment');
    fireEvent.change(within(form).getByLabelText('Ghi chú'), { target: { value: 'Vuốt xong' } });
    fireEvent.change(within(form).getByLabelText('Ngày'), { target: { value: '2026-09-03' } });
    fireEvent.change(within(form).getByLabelText('Giờ'), { target: { value: '14:30' } });
    fireEvent.click(within(form).getByRole('button', { name: 'Lưu mốc' }));
    await waitFor(() =>
      expect(api.appendJournalEntry).toHaveBeenCalledWith(`${ID}1`, {
        stage: 'throw',
        declaredDate: '2026-09-03',
        note: '14:30 · Vuốt xong',
        images: [],
      }),
    );
  });

  it('nhảy công đoạn thì phải ghi lý do', async () => {
    renderVi(<JournalEditor productId={`${ID}1`} client={client()} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Thêm mốc' }));
    expect(screen.queryByLabelText('Lý do bỏ qua công đoạn trước')).toBeNull();
    fireEvent.change(screen.getByLabelText('Công đoạn'), { target: { value: 'fire' } });
    expect(screen.getByLabelText('Lý do bỏ qua công đoạn trước')).toBeTruthy();
  });

  it('trước khi xuất bản xóa được mốc; sau khi xuất bản chỉ thêm mốc đính chính', async () => {
    const draft = client();
    const first = renderVi(<JournalEditor productId={`${ID}1`} client={draft} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Xóa mốc' }));
    // Deleting a milestone is irreversible, so it waits for a confirmation.
    expect(draft.deleteJournalEntry).not.toHaveBeenCalled();
    confirmDialog('Xóa mốc');
    await waitFor(() => expect(draft.deleteJournalEntry).toHaveBeenCalledWith(`${ID}5`, 1));
    first.unmount();

    const sealed = client();
    renderVi(<JournalEditor productId={`${ID}2`} client={sealed} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Đính chính' }));
    expect(screen.queryByRole('button', { name: 'Xóa mốc' })).toBeNull();
    const form = screen.getByTestId('journal-form');
    fireEvent.change(within(form).getByLabelText('Ghi chú'), { target: { value: 'Sửa lại ngày' } });
    fireEvent.click(within(form).getByRole('button', { name: 'Lưu mốc' }));
    expect(sealed.appendJournalEntry).not.toHaveBeenCalled();
    confirmDialog('Lưu mốc');
    await waitFor(() =>
      expect(sealed.appendJournalEntry).toHaveBeenCalledWith(
        `${ID}2`,
        expect.objectContaining({ stage: 'clay', supersedesEntryId: `${ID}5` }),
      ),
    );
  });
});

describe('tiện ích nhật ký', () => {
  it('ngày giờ theo đồng hồ của ảnh; ảnh quá 30 ngày bị nhắc', () => {
    expect(exifFields(new Date(2026, 8, 3, 14, 5))).toEqual({ date: '2026-09-03', time: '14:05' });
    const now = new Date('2026-10-31T00:00:00Z');
    expect(isOldPhoto(new Date('2026-09-01T00:00:00Z'), now)).toBe(true);
    expect(isOldPhoto(new Date('2026-10-20T00:00:00Z'), now)).toBe(false);
  });

  it('gắn giờ vào ghi chú; chọn bản WebP rộng nhất kèm checksum', () => {
    expect(noteWithTime(' Nung ', '')).toBe('Nung');
    expect(noteWithTime('Nung', '09:00')).toBe('09:00 · Nung');
    const image = journalImageOf({
      sha256: 'b'.repeat(64),
      variants: [
        { format: 'avif', width: 2048, height: 1, url: 'https://cdn/a.avif' },
        { format: 'webp', width: 640, height: 1, url: 'https://cdn/s.webp' },
        { format: 'webp', width: 1280, height: 1, url: 'https://cdn/l.webp' },
      ],
    } as never);
    expect(image).toEqual({ url: 'https://cdn/l.webp', sha256: 'b'.repeat(64) });
  });
});
