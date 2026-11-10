import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { ApiError, type StudioClient } from '@vcraft/api-client';
import type { HouseholdDto, JournalDto, ProductDto, ProductScanStatsDto } from '@vcraft/contracts';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  exifFields,
  isOldPhoto,
  JournalEditor,
  journalImageOf,
  noteWithTime,
} from '@/features/studio/journal-editor';
import { NewProductForm } from '@/features/studio/new-product-form';
import { ProductEditor, toProductUpdate } from '@/features/studio/product-editor';
import { EMPTY_PRODUCT, parseNewProduct } from '@/features/studio/product-fields';
import { ProductList } from '@/features/studio/product-list';
import { confirmDialog, openDialog } from './confirm';
import { renderVi } from './render';

const push = vi.fn();
vi.mock('@/i18n/navigation', () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a href="/x">{children}</a>,
  usePathname: () => '/studio/san-pham',
  useRouter: () => ({ push }),
}));
vi.mock('@/features/traceability/trace-qr', () => ({
  TraceQr: () => <div data-testid="qr" />,
  QR_LOGO_URL: '/brand/icon-512.png',
  QR_LOGO_OPTIONS: { margin: 4, hideBackgroundDots: true, imageSize: 0.3 },
}));
const qrDownload = vi.hoisted(() => vi.fn(async () => {}));
const qrOptions = vi.hoisted(() => vi.fn());
vi.mock('qr-code-styling', () => ({
  default: class {
    constructor(options: unknown) {
      qrOptions(options);
    }
    download = qrDownload;
  },
}));
const media = vi.hoisted(() => ({ prepareImage: vi.fn(), sendMedia: vi.fn() }));
vi.mock('@/features/media/prepare-image', () => media);

const ID = '00000000-0000-4000-8000-00000000000';

function product(n: number, overrides: Partial<ProductDto> = {}): ProductDto {
  return {
    id: `${ID}${n}`,
    version: 2,
    name: `Món ${n}`,
    nameEn: null,
    slug: `mon-${n}`,
    traceCode: `CODE000${n}`,
    description: '',
    descriptionEn: null,
    kind: 'OBJECT',
    batchSize: null,
    category: 'VASE',
    priceVnd: 100_000,
    stock: 1,
    material: null,
    dimensions: null,
    materialEn: null,
    dimensionsEn: null,
    weightGrams: null,
    artisanNote: null,
    tags: [],
    coverUrl: null,
    coverVariants: [],
    coverAlt: null,
    coverAltEn: null,
    images: [],
    status: 'DRAFT',
    publishedAt: null,
    withdrawnBy: null,
    withdrawnReason: null,
    makers: [],
    postedBy: 'HOUSEHOLD_ADMINISTRATION',
    ...overrides,
  };
}

const HOUSEHOLD = {
  id: `${ID}9`,
  version: 1,
  name: 'Hộ',
  nameEn: null,
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

const SCAN_STATS: ProductScanStatsDto = {
  total: 42,
  last30Days: 7,
  daily: Array.from({ length: 30 }, (_, i) => ({
    date: `2026-11-${String(i + 1).padStart(2, '0')}`,
    count: i === 29 ? 7 : 0,
  })),
  byCountry: [
    { country: 'VN', count: 5 },
    { country: null, count: 2 },
  ],
  byDeviceType: [{ deviceType: 'mobile', count: 7 }],
};
const READY_PHOTO = {
  id: `${ID}6`,
  status: 'READY',
  sha256: 'c'.repeat(64),
  variants: [{ format: 'webp', width: 1280, height: 800, url: 'https://cdn.test/j-1280.webp' }],
};
const PHOTO_IMAGE = { url: 'https://cdn.test/j-1280.webp', sha256: 'c'.repeat(64) };

/** Picks a photo in the milestone form; `capturedAt` is the EXIF date the browser would read from it. */
async function pickPhoto(form: HTMLElement, capturedAt: Date | null = null) {
  media.prepareImage.mockResolvedValue({
    file: new File(['x'], 'clay.jpg', { type: 'image/jpeg' }),
    capturedAt,
  });
  media.sendMedia.mockResolvedValue({ id: READY_PHOTO.id });
  const input = within(form).getByLabelText('Ảnh công đoạn') as HTMLInputElement;
  fireEvent.change(input, {
    target: { files: [new File(['x'], 'clay.jpg', { type: 'image/jpeg' })] },
  });
  await act(async () => {});
}

function client(overrides: Partial<StudioClient> = {}): StudioClient {
  return {
    getHousehold: vi.fn(async () => HOUSEHOLD),
    getJournal: vi.fn(async () => JOURNAL),
    getScanStats: vi.fn(async () => SCAN_STATS),
    getMedia: vi.fn(async () => READY_PHOTO),
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
  it('lọc nháp, đang trưng bày, lưu trữ', async () => {
    renderVi(<ProductList client={client()} />);
    const list = await screen.findByTestId('studio-products');
    expect(within(list).getAllByRole('listitem')).toHaveLength(3);
    fireEvent.click(screen.getByRole('radio', { name: 'Lưu trữ' }));
    expect(within(screen.getByTestId('studio-products')).getByText('Món 3')).toBeTruthy();
    expect(screen.queryByText('Món 1')).toBeNull();
  });

  it('hộ chưa được duyệt không thấy nút thêm sản phẩm, chỉ thấy lời giải thích (GH#237)', async () => {
    const pending = { ...HOUSEHOLD, status: 'PENDING_REVIEW', products: [] } as HouseholdDto;
    renderVi(<ProductList client={client({ getHousehold: vi.fn(async () => pending) })} />);
    expect(
      await screen.findByText('Hộ được Ban quản lý duyệt hồ sơ xong thì mới đăng được sản phẩm.'),
    ).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Thêm sản phẩm' })).toBeNull();
  });
});

describe('NewProductForm', () => {
  it('retains the product submission key on retry and replaces it for changed input', async () => {
    const create = vi
      .fn<StudioClient['createProduct']>()
      .mockRejectedValue(new TypeError('Timeout'));
    renderVi(<NewProductForm client={client({ createProduct: create })} />);
    const name = await screen.findByLabelText('Tên sản phẩm');
    fireEvent.change(name, { target: { value: 'Bình' } });
    const save = () => fireEvent.click(screen.getByRole('button', { name: 'Tạo sản phẩm' }));
    save();
    await screen.findByRole('alert');
    save();
    await waitFor(() => expect(create).toHaveBeenCalledTimes(2));
    const first = create.mock.calls[0]?.[1]?.idempotencyKey;
    expect(first).toEqual(expect.any(String));
    expect(create.mock.calls[1]?.[1]?.idempotencyKey).toBe(first);
    fireEvent.change(name, { target: { value: 'Bình lớn' } });
    save();
    await waitFor(() => expect(create).toHaveBeenCalledTimes(3));
    expect(create.mock.calls[2]?.[1]?.idempotencyKey).not.toBe(first);
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
  it('reuses the duplicate product key after a timeout', async () => {
    const duplicate = vi
      .fn<StudioClient['duplicateProduct']>()
      .mockRejectedValueOnce(new TypeError('Timeout'))
      .mockResolvedValue(product(4));
    renderVi(
      <ProductEditor productId={`${ID}1`} client={client({ duplicateProduct: duplicate })} />,
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Nhân bản' }));
    await screen.findByRole('alert');
    fireEvent.click(screen.getByRole('button', { name: 'Nhân bản' }));
    await waitFor(() => expect(duplicate).toHaveBeenCalledTimes(2));
    const first = duplicate.mock.calls[0]?.[1]?.idempotencyKey;
    expect(first).toEqual(expect.any(String));
    expect(duplicate.mock.calls[1]?.[1]?.idempotencyKey).toBe(first);
  });

  beforeEach(() => {
    qrDownload.mockClear();
    qrOptions.mockClear();
  });

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

  it('explains a board withdrawal with its reason and offers no republish button (GH#428)', async () => {
    const boardWithdrawn = product(4, {
      status: 'WITHDRAWN',
      publishedAt: '2026-09-01T00:00:00.000Z',
      withdrawnBy: 'BOARD',
      withdrawnReason: 'Counterfeit listing',
    });
    const api = client({
      getHousehold: vi.fn(async () => ({
        ...HOUSEHOLD,
        products: [...HOUSEHOLD.products, boardWithdrawn],
      })),
    });
    renderVi(<ProductEditor productId={`${ID}4`} client={api} />);
    expect(await screen.findByText(/Ban quản lý đã gỡ sản phẩm này/)).toBeTruthy();
    expect(screen.getByText('Lý do của Ban quản lý: Counterfeit listing')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Xuất bản lại' })).toBeNull();
  });

  it('xuất bản bị từ chối vì chưa có mốc nhật ký thì báo rõ cách khắc phục (FR-PRD-03)', async () => {
    const api = client({
      publishProduct: vi.fn(async () => {
        throw new ApiError('PRODUCT_JOURNAL_REQUIRED', 409);
      }),
    });
    renderVi(<ProductEditor productId={`${ID}1`} client={api} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Xuất bản' }));
    confirmDialog('Xuất bản');
    expect(
      await screen.findByText(
        'Hãy thêm ít nhất một mốc nhật ký sản xuất (kèm ảnh) trước khi xuất bản.',
      ),
    ).toBeTruthy();
  });

  it('lưu trữ cần lý do', async () => {
    const api = client();
    renderVi(<ProductEditor productId={`${ID}2`} client={api} />);
    const withdraw = await screen.findByRole('button', { name: 'Lưu trữ' });
    expect((withdraw as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('Lý do lưu trữ'), { target: { value: 'Hết hàng' } });
    fireEvent.click(withdraw);
    confirmDialog('Lưu trữ');
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
      expect(api.setMakers).toHaveBeenCalledWith(`${ID}1`, 2, {
        makers: [{ artisanId: `${ID}8`, contribution: 'Vuốt dáng' }],
      }),
    );
    expect(screen.getByTestId('qr')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Tải PNG' })).toBeTruthy();
  });

  it('reloads and says so when the makers were saved against an old product version (GH#420)', async () => {
    const api = client({
      setMakers: vi.fn(async () => {
        throw new ApiError('STALE_VERSION', 409);
      }) as never,
    });
    renderVi(<ProductEditor productId={`${ID}1`} client={api} />);
    fireEvent.change(await screen.findByLabelText('Phần việc của Bình'), {
      target: { value: 'Vuốt dáng' },
    });
    const section = screen.getByRole('heading', { name: 'Người làm' }).parentElement as HTMLElement;
    fireEvent.click(within(section).getByRole('button', { name: 'Lưu' }));
    expect((await within(section).findByRole('alert')).textContent).toMatch(
      /vừa được sửa ở nơi khác/,
    );
    // The editor reloads the product to show the version the next save must name.
    expect(api.getHousehold).toHaveBeenCalledTimes(2);
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

  it('downloads the QR as PNG or SVG with the centre logo and level H (FR-TRC-02)', async () => {
    renderVi(<ProductEditor productId={`${ID}1`} client={client()} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Tải SVG' }));
    await waitFor(() =>
      expect(qrDownload).toHaveBeenCalledWith({ name: 'vcraft-qr-CODE0001', extension: 'svg' }),
    );
    expect(qrOptions).toHaveBeenLastCalledWith(
      expect.objectContaining({
        type: 'svg',
        image: '/brand/icon-512.png',
        imageOptions: expect.objectContaining({ hideBackgroundDots: true, imageSize: 0.3 }),
        qrOptions: { errorCorrectionLevel: 'H' },
      }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Tải PNG' }));
    await waitFor(() =>
      expect(qrDownload).toHaveBeenLastCalledWith({ name: 'vcraft-qr-CODE0001', extension: 'png' }),
    );
    expect(qrOptions).toHaveBeenLastCalledWith(expect.objectContaining({ type: 'canvas' }));
  });

  it('shows the scan statistics of the product (FR-TRC-06)', async () => {
    const api = client();
    renderVi(<ProductEditor productId={`${ID}1`} client={api} />);
    expect(await screen.findByTestId('scan-total')).toHaveProperty('textContent', '42');
    expect(api.getScanStats).toHaveBeenCalledWith(`${ID}1`);
    expect(screen.getByTestId('scan-last30').textContent).toBe('7');
    expect(screen.getByText('Việt Nam')).toBeTruthy();
    expect(screen.getByText('Điện thoại')).toBeTruthy();
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

  it('after a 409 the details draft shows the server values, not the stale edit', async () => {
    const newer = {
      ...HOUSEHOLD,
      products: [
        product(1, { version: 3, name: 'Tên từ người khác' }),
        ...HOUSEHOLD.products.slice(1),
      ],
    } as unknown as HouseholdDto;
    const getHousehold = vi.fn().mockResolvedValueOnce(HOUSEHOLD).mockResolvedValue(newer);
    const api = client({
      getHousehold,
      updateProduct: vi.fn(async () => {
        throw new ApiError('STALE_VERSION', 409);
      }),
    });
    renderVi(<ProductEditor productId={`${ID}1`} client={api} />);
    const input = (await screen.findByDisplayValue('Món 1')) as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'Chỉnh sửa của tôi' } });
    const section = screen.getByRole('heading', { name: 'Thông tin' }).parentElement as HTMLElement;
    fireEvent.click(within(section).getByRole('button', { name: 'Lưu' }));
    expect(await within(section).findByText(/nhập lại thay đổi chưa lưu/)).toBeTruthy();
    await waitFor(() => expect(screen.getByDisplayValue('Tên từ người khác')).toBeTruthy());
    expect(screen.queryByDisplayValue('Chỉnh sửa của tôi')).toBeNull();
  });
});

describe('JournalEditor', () => {
  it('reuses the journal submission key after a client timeout', async () => {
    const append = vi
      .fn<StudioClient['appendJournalEntry']>()
      .mockRejectedValueOnce(new TypeError('Request timed out'))
      .mockResolvedValue(JOURNAL);
    renderVi(
      <JournalEditor productId={`${ID}1`} client={client({ appendJournalEntry: append })} />,
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Thêm mốc' }));
    const form = screen.getByTestId('journal-form');
    fireEvent.change(within(form).getByLabelText('Ghi chú'), { target: { value: 'Vuốt xong' } });
    await pickPhoto(form);
    fireEvent.click(within(form).getByRole('button', { name: 'Lưu mốc' }));
    await waitFor(() => expect(append).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(within(form).getByRole('button', { name: 'Lưu mốc' }).hasAttribute('disabled')).toBe(
        false,
      ),
    );
    fireEvent.click(within(form).getByRole('button', { name: 'Lưu mốc' }));
    await waitFor(() => expect(append).toHaveBeenCalledTimes(2));
    const first = append.mock.calls[0]?.[2]?.idempotencyKey;
    expect(first).toEqual(expect.any(String));
    expect(append.mock.calls[1]?.[2]?.idempotencyKey).toBe(first);
  });

  it('starts a new journal submission after the note changes or an entry succeeds', async () => {
    const append = vi
      .fn<StudioClient['appendJournalEntry']>()
      .mockRejectedValueOnce(new TypeError('Timeout'))
      .mockResolvedValue(JOURNAL);
    renderVi(
      <JournalEditor productId={`${ID}1`} client={client({ appendJournalEntry: append })} />,
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Thêm mốc' }));
    let form = screen.getByTestId('journal-form');
    fireEvent.change(within(form).getByLabelText('Ghi chú'), { target: { value: 'Vuốt xong' } });
    await pickPhoto(form);
    fireEvent.click(within(form).getByRole('button', { name: 'Lưu mốc' }));
    await waitFor(() => expect(within(form).getByRole('alert')).toBeTruthy());
    fireEvent.change(within(form).getByLabelText('Ghi chú'), {
      target: { value: 'Vuốt hoàn tất' },
    });
    fireEvent.click(within(form).getByRole('button', { name: 'Lưu mốc' }));
    await waitFor(() => expect(screen.queryByTestId('journal-form')).toBeNull());
    expect(append.mock.calls[1]?.[2]?.idempotencyKey).not.toBe(
      append.mock.calls[0]?.[2]?.idempotencyKey,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Thêm mốc' }));
    form = screen.getByTestId('journal-form');
    fireEvent.change(within(form).getByLabelText('Ghi chú'), {
      target: { value: 'Vuốt hoàn tất' },
    });
    await pickPhoto(form);
    fireEvent.click(within(form).getByRole('button', { name: 'Lưu mốc' }));
    await waitFor(() => expect(append).toHaveBeenCalledTimes(3));
    expect(append.mock.calls[2]?.[2]?.idempotencyKey).not.toBe(
      append.mock.calls[1]?.[2]?.idempotencyKey,
    );
  });

  it('keeps the journal payload and key when a photo becomes ready between retries', async () => {
    const append = vi
      .fn<StudioClient['appendJournalEntry']>()
      .mockRejectedValueOnce(new TypeError('Timeout'))
      .mockResolvedValue(JOURNAL);
    const api = client({
      appendJournalEntry: append,
      getMedia: vi
        .fn()
        .mockRejectedValueOnce(new TypeError('Offline'))
        .mockResolvedValue(READY_PHOTO),
    });
    renderVi(<JournalEditor productId={`${ID}1`} client={api} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Thêm mốc' }));
    const form = screen.getByTestId('journal-form');
    fireEvent.change(within(form).getByLabelText('Ghi chú'), { target: { value: 'Vuốt xong' } });
    await pickPhoto(form);
    media.sendMedia.mockResolvedValue({ ...READY_PHOTO, status: 'PROCESSING', variants: [] });
    fireEvent.click(within(form).getByRole('button', { name: 'Lưu mốc' }));
    await waitFor(() => expect(within(form).getByRole('alert')).toBeTruthy());
    fireEvent.click(within(form).getByRole('button', { name: 'Lưu mốc' }));
    await waitFor(() => expect(append).toHaveBeenCalledTimes(2));
    expect(append.mock.calls[0]?.[1].images).toEqual([{ sha256: READY_PHOTO.sha256 }]);
    expect(append.mock.calls[1]).toEqual(append.mock.calls[0]);
  });

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
    await pickPhoto(form);
    fireEvent.click(within(form).getByRole('button', { name: 'Lưu mốc' }));
    await waitFor(() =>
      expect(api.appendJournalEntry).toHaveBeenCalledWith(
        `${ID}1`,
        {
          stage: 'throw',
          declaredDate: '2026-09-03',
          note: '14:30 · Vuốt xong',
          images: [PHOTO_IMAGE],
        },
        { idempotencyKey: expect.any(String) },
      ),
    );
  });

  it('không lưu mốc khi chưa có ảnh và báo lỗi ngay tại biểu mẫu (FR-PRD-04)', async () => {
    const api = client();
    renderVi(<JournalEditor productId={`${ID}1`} client={api} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Thêm mốc' }));
    const form = screen.getByTestId('journal-form');
    fireEvent.change(within(form).getByLabelText('Ghi chú'), { target: { value: 'Vuốt xong' } });
    fireEvent.click(within(form).getByRole('button', { name: 'Lưu mốc' }));
    expect(
      await within(form).findByText('Hãy thêm ít nhất một ảnh làm bằng chứng cho công đoạn này.'),
    ).toBeTruthy();
    expect(api.appendJournalEntry).not.toHaveBeenCalled();
    expect(media.sendMedia).not.toHaveBeenCalled();
  });

  it('ảnh chụp hơn 30 ngày trước phải được xác nhận rồi mới lưu mốc (FR-PRD-04)', async () => {
    const api = client();
    renderVi(<JournalEditor productId={`${ID}1`} client={api} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Thêm mốc' }));
    const form = screen.getByTestId('journal-form');
    fireEvent.change(within(form).getByLabelText('Ghi chú'), { target: { value: 'Vuốt xong' } });
    await pickPhoto(form, new Date(Date.now() - 45 * 24 * 60 * 60 * 1000));
    await within(form).findByText(/Ảnh chụp cách đây hơn 30 ngày/);
    fireEvent.click(within(form).getByRole('button', { name: 'Lưu mốc' }));

    expect(openDialog().textContent).toContain(
      'Ảnh này chụp hơn 30 ngày trước. Vẫn lưu mốc với ảnh này?',
    );
    expect(api.appendJournalEntry).not.toHaveBeenCalled();
    expect(media.sendMedia).not.toHaveBeenCalled();
    confirmDialog('Vẫn lưu');
    await waitFor(() =>
      expect(api.appendJournalEntry).toHaveBeenCalledWith(
        `${ID}1`,
        expect.objectContaining({ images: [PHOTO_IMAGE] }),
        { idempotencyKey: expect.any(String) },
      ),
    );
  });

  it('hủy xác nhận ảnh cũ thì không lưu mốc; ảnh mới chụp lưu thẳng', async () => {
    const api = client();
    renderVi(<JournalEditor productId={`${ID}1`} client={api} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Thêm mốc' }));
    const form = screen.getByTestId('journal-form');
    fireEvent.change(within(form).getByLabelText('Ghi chú'), { target: { value: 'Vuốt xong' } });
    await pickPhoto(form, new Date(Date.now() - 45 * 24 * 60 * 60 * 1000));
    await within(form).findByText(/Ảnh chụp cách đây hơn 30 ngày/);
    fireEvent.click(within(form).getByRole('button', { name: 'Lưu mốc' }));
    confirmDialog('Hủy');
    expect(api.appendJournalEntry).not.toHaveBeenCalled();

    // A recent photo needs no extra confirmation.
    await pickPhoto(form, new Date());
    await within(form).findByText('Đã điền ngày giờ theo ảnh.');
    fireEvent.click(within(form).getByRole('button', { name: 'Lưu mốc' }));
    await waitFor(() => expect(api.appendJournalEntry).toHaveBeenCalledTimes(1));
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
    await pickPhoto(form);
    fireEvent.click(within(form).getByRole('button', { name: 'Lưu mốc' }));
    expect(sealed.appendJournalEntry).not.toHaveBeenCalled();
    confirmDialog('Lưu mốc');
    await waitFor(() =>
      expect(sealed.appendJournalEntry).toHaveBeenCalledWith(
        `${ID}2`,
        expect.objectContaining({ stage: 'clay', supersedesEntryId: `${ID}5` }),
        { idempotencyKey: expect.any(String) },
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
