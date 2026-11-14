import type { ReactNode } from 'react';
import { preload } from 'react-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { preloadCardCovers } from '@/features/catalog/cover-preload';
import { ProductCard } from '@/features/catalog/product-card';
import type { PhotoView, ProductCardView } from '@/features/catalog/view-models';
import type { ImageVariant } from '@/lib/images';
import { renderVi } from './render';

vi.mock('react-dom', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-dom')>()),
  preload: vi.fn(),
}));

vi.mock('@/i18n/navigation', () => ({
  Link: ({ children, className }: { children: ReactNode; className?: string }) => (
    <a href="/x" className={className}>
      {children}
    </a>
  ),
}));

const STORAGE = 'https://ref.supabase.co/storage/v1/object/public/media';

function cover(
  id: string,
  formats: readonly ImageVariant['format'][] = ['webp', 'avif'],
): PhotoView {
  return {
    src: `${STORAGE}/${id}/1280.webp`,
    alt: `Cover ${id}`,
    variants: formats.flatMap((format) =>
      [1280, 640].map((width) => ({
        format,
        width,
        height: Math.round(width * 0.6),
        url: `${STORAGE}/${id}/${width}.${format}`,
      })),
    ),
  };
}

function card(id: string, image: ProductCardView['image'] = cover(id)): ProductCardView {
  return {
    id,
    slug: `item-${id}`,
    name: `Item ${id}`,
    presetKind: 'vase',
    tint: '#888',
    price: 100_000,
    oneOfAKind: false,
    image,
  };
}

describe('Product cover preloads', () => {
  beforeEach(() => {
    vi.mocked(preload).mockClear();
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://ref.supabase.co');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it.each([
    { name: 'AVIF with WebP fallback', formats: ['webp', 'avif'], type: 'image/avif' },
    { name: 'WebP only', formats: ['webp'], type: 'image/webp' },
    { name: 'AVIF only', formats: ['avif'], type: 'image/avif' },
  ] as const)('matches the rendered priority card for $name', ({ formats, type }) => {
    const product = card('1', cover('1', formats));
    preloadCardCovers([product]);
    const { container } = renderVi(<ProductCard product={product} priority />);
    const img = container.querySelector('img');
    const preferred = container.querySelector('source');

    expect(img?.getAttribute('src')).toBe('/media-cache/media/1/1280.webp');
    expect(img?.getAttribute('width')).toBe('1280');
    expect(img?.getAttribute('height')).toBe('768');
    expect(preferred?.getAttribute('type')).toBe(type);
    const extension = type.slice('image/'.length);
    expect(preferred?.getAttribute('srcset')).toBe(
      `/media-cache/media/1/640.${extension} 640w, /media-cache/media/1/1280.${extension} 1280w`,
    );
    expect(preload).toHaveBeenCalledTimes(1);
    expect(preload).toHaveBeenCalledWith(img?.getAttribute('src'), {
      as: 'image',
      fetchPriority: 'high',
      imageSrcSet: preferred?.getAttribute('srcset'),
      imageSizes: preferred?.getAttribute('sizes'),
      type,
    });
  });

  it('keeps the Storage origin in both callers when the project URL is unset', () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '');
    const product = card('1');
    preloadCardCovers([product]);
    const { container } = renderVi(<ProductCard product={product} priority />);
    const img = container.querySelector('img');
    const preferred = container.querySelector('source');

    expect(img?.getAttribute('src')).toBe(`${STORAGE}/1/1280.webp`);
    expect(preload).toHaveBeenCalledWith(img?.getAttribute('src'), {
      as: 'image',
      fetchPriority: 'high',
      imageSrcSet: preferred?.getAttribute('srcset'),
      imageSizes: preferred?.getAttribute('sizes'),
      type: 'image/avif',
    });
  });

  it.each([
    { name: 'absent', variants: undefined },
    { name: 'empty', variants: [] },
    {
      name: 'unusable',
      variants: [{ format: 'webp', width: 0, height: 0, url: `${STORAGE}/1/0.webp` }],
    },
  ] as const)('renders the fallback and skips the hint when variants are $name', ({ variants }) => {
    const product = card('1', {
      src: `${STORAGE}/1/1280.webp`,
      alt: 'Cover',
      ...(variants && { variants }),
    });
    preloadCardCovers([product]);
    const { container } = renderVi(<ProductCard product={product} priority />);

    expect(container.querySelectorAll('source')).toHaveLength(0);
    expect(container.querySelector('img')?.getAttribute('src')).toBe(
      '/media-cache/media/1/1280.webp',
    );
    expect(preload).not.toHaveBeenCalled();
  });

  it('preloads only the first two covers', () => {
    preloadCardCovers([card('1'), card('2'), card('3')]);

    expect(vi.mocked(preload).mock.calls.map(([src]) => src)).toEqual([
      '/media-cache/media/1/1280.webp',
      '/media-cache/media/2/1280.webp',
    ]);
  });

  it('skips stand-ins and demo photos without filling their slots from later cards', () => {
    const standIn = { ...card('1'), image: undefined };
    const demo = card('2', { photo: { id: 'demo', alt: 'Demo' }, alt: 'Demo' });
    preloadCardCovers([standIn, demo, card('3')]);

    expect(preload).not.toHaveBeenCalled();
  });
});
