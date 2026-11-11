import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import type { StudioClient } from '@vcraft/api-client';
import type { JournalDto, ProductDto } from '@vcraft/contracts';
import { rgbaToThumbHash } from 'thumbhash';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ImageSlot } from '@/components/image-slot';
import { MEDIA_POLL_MS } from '@/features/media/use-media-watch';
import { JournalEditor } from '@/features/studio/journal-editor';
import { ProductPhotos } from '@/features/studio/product-photos';
import { thumbhashDataUrl } from '@/lib/thumbhash';
import { renderVi } from './render';

const live = vi.hoisted(() => ({
  listener: null as null | ((event: unknown) => void),
  status: 'polling',
}));
vi.mock('@/lib/api/live-events', () => ({
  useLiveEvents: (listener: (event: unknown) => void) => {
    live.listener = listener;
    return live.status;
  },
}));
const media = vi.hoisted(() => ({ prepareImage: vi.fn(), sendMedia: vi.fn() }));
vi.mock('@/features/media/prepare-image', () => media);
vi.mock('@/lib/api/live-session', () => ({ browserAccessToken: () => async () => 'token' }));
vi.mock('@/i18n/navigation', () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a href="/x">{children}</a>,
  usePathname: () => '/studio/san-pham',
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock('@/features/studio/household-gate', () => ({
  HouseholdGate: ({
    client,
    children,
  }: {
    client: StudioClient;
    children: (context: { household: unknown; client: StudioClient }) => React.ReactNode;
  }) => children({ household: { products: [PRODUCT] }, client }),
}));

const ID = '00000000-0000-4000-8000-00000000000';
const PHOTO_ID = `${ID}6`;
const SHA = 'c'.repeat(64);
const VARIANT = { format: 'webp', width: 1280, height: 800, url: 'https://cdn.test/p-1280.webp' };

/** A real ThumbHash of a 4x4 orange image, as the worker would store it. */
const THUMBHASH = Buffer.from(
  rgbaToThumbHash(
    4,
    4,
    new Uint8Array(4 * 4 * 4).map((_, i) => (i % 4 === 3 ? 255 : 200)),
  ),
).toString('base64');

const PRODUCT = {
  id: `${ID}1`,
  version: 1,
  name: 'Bình',
  category: 'VASE',
  publishedAt: null,
  images: [],
} as unknown as ProductDto;

function processingProduct(): ProductDto {
  return {
    ...PRODUCT,
    images: [{ mediaId: PHOTO_ID, url: null, variants: [], thumbhash: null, alt: 'Bình men lam' }],
  } as ProductDto;
}

const READY = {
  id: PHOTO_ID,
  status: 'READY',
  sha256: SHA,
  thumbhash: THUMBHASH,
  variants: [VARIANT],
};
const PROCESSING = {
  id: PHOTO_ID,
  status: 'PROCESSING',
  sha256: SHA,
  thumbhash: null,
  variants: [],
};

const EMPTY_JOURNAL: JournalDto = {
  productId: PRODUCT.id,
  entries: [],
  inProgress: true,
  missingStages: [],
};

function studio(getMedia: unknown): StudioClient {
  return {
    getMedia,
    updateProduct: vi.fn(),
    getJournal: vi.fn(async () => EMPTY_JOURNAL),
    appendJournalEntry: vi.fn(async () => EMPTY_JOURNAL),
  } as unknown as StudioClient;
}

const updated = (status: 'READY' | 'FAILED') => ({
  type: 'media.updated',
  id: PHOTO_ID,
  status,
  url: status === 'READY' ? VARIANT.url : null,
  variants: status === 'READY' ? [VARIANT] : [],
  thumbhash: status === 'READY' ? THUMBHASH : null,
  width: status === 'READY' ? 1280 : null,
  height: status === 'READY' ? 800 : null,
});

afterEach(() => {
  vi.useRealTimers();
  live.listener = null;
  live.status = 'polling';
});

describe('ThumbHash placeholder (GH#252)', () => {
  it('decodes a stored ThumbHash into a data URL, and ignores a missing one', () => {
    expect(thumbhashDataUrl(THUMBHASH)).toMatch(/^data:image\/png;base64,/);
    expect(thumbhashDataUrl(null)).toBeUndefined();
    expect(thumbhashDataUrl('')).toBeUndefined();
  });

  it('paints the blurred placeholder behind the image until it has loaded', () => {
    const { container } = renderVi(
      <ImageSlot alt="Bình" tint="#8a5a3c" src="https://cdn.test/a.webp" thumbhash={THUMBHASH} />,
    );
    const frame = container.firstElementChild as HTMLElement;
    expect(frame.style.background).toContain('data:image/png;base64,');
    expect(container.querySelector('img')?.getAttribute('src')).toBe('https://cdn.test/a.webp');
  });

  it('keeps the tinted background when there is no ThumbHash', () => {
    const { container } = renderVi(
      <ImageSlot alt="Bình" tint="#8a5a3c" src="https://cdn.test/a.webp" />,
    );
    expect((container.firstElementChild as HTMLElement).style.background).not.toContain('data:');
  });
});

describe('product photo tiles follow processing', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  it('turns a processing tile into the image when media.updated arrives', async () => {
    live.status = 'live';
    // The check says PROCESSING, so only the live event can finish the tile here.
    renderVi(
      <ProductPhotos
        product={processingProduct()}
        client={studio(async () => PROCESSING)}
        onSaved={async () => {}}
      />,
    );
    expect(screen.getByTestId('photo-tile').getAttribute('data-status')).toBe('PROCESSING');
    expect(screen.getByText('Đang xử lý')).toBeTruthy();

    act(() => live.listener?.(updated('READY')));

    const tile = screen.getByTestId('photo-tile');
    expect(tile.getAttribute('data-status')).toBe('READY');
    expect(tile.querySelector('img')?.getAttribute('src')).toBe(VARIANT.url);
    expect(tile.style.background).toContain('data:image/png;base64,');
  });

  it('polls GET /media/:id every 5 s when the stream is down, then shows the image', async () => {
    const getMedia = vi.fn().mockResolvedValueOnce(PROCESSING).mockResolvedValue(READY);
    renderVi(
      <ProductPhotos
        product={processingProduct()}
        client={studio(getMedia)}
        onSaved={async () => {}}
      />,
    );
    await waitFor(() => expect(getMedia).toHaveBeenCalledTimes(1));
    expect(screen.getByTestId('photo-tile').getAttribute('data-status')).toBe('PROCESSING');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(MEDIA_POLL_MS + 100);
    });
    await waitFor(() =>
      expect(screen.getByTestId('photo-tile').getAttribute('data-status')).toBe('READY'),
    );
    expect(getMedia).toHaveBeenCalledWith(PHOTO_ID);
  });

  it('shows a clear message with retry and remove when processing failed', () => {
    live.status = 'live';
    renderVi(
      <ProductPhotos
        product={processingProduct()}
        client={studio(async () => PROCESSING)}
        onSaved={async () => {}}
      />,
    );
    act(() => live.listener?.(updated('FAILED')));

    const tile = screen.getByTestId('photo-tile');
    expect(within(tile).getByRole('alert').textContent).toMatch(/Không xử lý được ảnh/);
    expect(screen.getByRole('button', { name: 'Chọn ảnh khác' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Xóa' }));
    expect(screen.queryByTestId('photo-tile')).toBeNull();
  });
});

describe('journal milestone with a photo that is still processing', () => {
  it('saves by checksum alone instead of failing (GH#252)', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    media.prepareImage.mockResolvedValue({
      file: new File(['x'], 'clay.jpg', { type: 'image/jpeg' }),
      capturedAt: null,
    });
    media.sendMedia.mockResolvedValue(PROCESSING);
    const api = studio(vi.fn(async () => PROCESSING));
    renderVi(<JournalEditor productId={PRODUCT.id} client={api} />);
    fireEvent.click((await screen.findAllByRole('button', { name: 'Thêm mốc' }))[0] as HTMLElement);
    const form = screen.getByTestId('journal-form');
    fireEvent.change(within(form).getByLabelText('Ghi chú'), { target: { value: 'Vuốt xong' } });
    fireEvent.change(within(form).getByLabelText('Ảnh công đoạn'), {
      target: { files: [new File(['x'], 'clay.jpg', { type: 'image/jpeg' })] },
    });
    await act(async () => {});
    fireEvent.click(within(form).getByRole('button', { name: 'Lưu mốc' }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    await waitFor(() => expect(api.appendJournalEntry).toHaveBeenCalledTimes(1));
    expect(vi.mocked(api.appendJournalEntry).mock.calls[0]?.[1].images).toEqual([{ sha256: SHA }]);
  });

  it('shows a placeholder for the processing photo, then the image once it is ready', async () => {
    const journal = (status: 'PROCESSING' | 'READY'): JournalDto => ({
      ...EMPTY_JOURNAL,
      entries: [
        {
          id: `${ID}5`,
          version: 1,
          seq: 0,
          stage: 'clay',
          declaredDate: '2026-09-01',
          note: 'Nhào đất',
          images: [
            {
              sha256: SHA,
              url: status === 'READY' ? VARIANT.url : null,
              variants: status === 'READY' ? [VARIANT as never] : [],
              credit: null,
              mediaId: PHOTO_ID,
              status,
              thumbhash: status === 'READY' ? THUMBHASH : null,
              alt: null,
            },
          ],
          skipReason: null,
          supersedesSeq: null,
          supersededBySeq: null,
          recordedAt: '2026-09-01T00:00:00.000Z',
          prevHash: 'GENESIS',
          hash: 'a'.repeat(64),
        },
      ],
    });
    live.status = 'live';
    const getJournal = vi
      .fn()
      .mockResolvedValueOnce(journal('PROCESSING'))
      .mockResolvedValue(journal('READY'));
    const api = { ...studio(async () => PROCESSING), getJournal } as unknown as StudioClient;
    renderVi(<JournalEditor productId={PRODUCT.id} client={api} />);
    const photos = await screen.findByTestId('entry-photos');
    expect(within(photos).getByRole('status').textContent).toBe('Đang xử lý');

    act(() => live.listener?.(updated('READY')));
    await waitFor(() =>
      expect(screen.getByTestId('entry-photos').querySelector('img')?.getAttribute('src')).toBe(
        VARIANT.url,
      ),
    );
  });
});
