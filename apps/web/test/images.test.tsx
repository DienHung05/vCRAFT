import { afterEach, describe, expect, it, vi } from 'vitest';
import { ImageSlot } from '@/components/image-slot';
import { photoFromUrl, slotPhoto } from '@/features/catalog/view-models';
import { buildResponsiveImage, frameRatioOf, type ImageVariant } from '@/lib/images';
import { renderVi } from './render';

const variant = (format: 'avif' | 'webp', width: number): ImageVariant => ({
  format,
  width,
  height: Math.round(width * 0.6),
  url: `https://cdn.test/v/${width}.${format}`,
});

// Deliberately unsorted: the API order must not matter.
const VARIANTS = [
  variant('webp', 1280),
  variant('avif', 640),
  variant('webp', 320),
  variant('avif', 1280),
  variant('webp', 640),
  variant('avif', 320),
];

describe('buildResponsiveImage', () => {
  it('builds one srcset per format, narrowest first, with w descriptors', () => {
    const built = buildResponsiveImage(VARIANTS);
    expect(built.avif).toBe(
      'https://cdn.test/v/320.avif 320w, https://cdn.test/v/640.avif 640w, https://cdn.test/v/1280.avif 1280w',
    );
    expect(built.webp).toBe(
      'https://cdn.test/v/320.webp 320w, https://cdn.test/v/640.webp 640w, https://cdn.test/v/1280.webp 1280w',
    );
  });

  it('takes the intrinsic size from the widest WebP', () => {
    expect(buildResponsiveImage(VARIANTS)).toMatchObject({ width: 1280, height: 768 });
  });

  it('returns nothing for a file that exists at one size only', () => {
    expect(buildResponsiveImage([])).toEqual({});
    expect(buildResponsiveImage(undefined)).toEqual({});
  });

  it('omits a format that was not generated', () => {
    const built = buildResponsiveImage([variant('webp', 640)]);
    expect(built.avif).toBeUndefined();
    expect(built.webp).toBe('https://cdn.test/v/640.webp 640w');
  });

  it('maps every variant URL through the given function', () => {
    const built = buildResponsiveImage(VARIANTS, (url) => url.replace('https://cdn.test', ''));
    expect(built.avif).toBe('/v/320.avif 320w, /v/640.avif 640w, /v/1280.avif 1280w');
  });

  it('lists a width only once', () => {
    const built = buildResponsiveImage([variant('webp', 640), variant('webp', 640)]);
    expect(built.webp).toBe('https://cdn.test/v/640.webp 640w');
  });
});

describe('<ImageSlot> with variants', () => {
  const props = photoFromUrl('https://cdn.test/v/1280.webp', 'Alt', VARIANTS);

  it('renders AVIF then WebP sources with the given sizes, and a lazy async img', () => {
    const { container } = renderVi(
      <ImageSlot alt="Alt" tint="#888" ratio="3/2" sizes="88vw" {...slotPhoto(props)} />,
    );
    const sources = [...container.querySelectorAll('source')];
    expect(sources.map((s) => s.getAttribute('type'))).toEqual(['image/avif', 'image/webp']);
    expect(sources.every((s) => s.getAttribute('sizes') === '88vw')).toBe(true);
    const img = container.querySelector('img');
    expect(img?.getAttribute('src')).toBe('https://cdn.test/v/1280.webp');
    expect(img?.getAttribute('loading')).toBe('lazy');
    expect(img?.getAttribute('decoding')).toBe('async');
    expect(img?.getAttribute('fetchpriority')).toBeNull();
    expect(img?.getAttribute('width')).toBe('1280');
    expect(img?.getAttribute('height')).toBe('768');
  });

  it('loads the priority image eagerly with high fetch priority', () => {
    const { container } = renderVi(
      <ImageSlot alt="Alt" tint="#888" priority sizes="100vw" {...slotPhoto(props)} />,
    );
    const img = container.querySelector('img');
    expect(img?.getAttribute('loading')).toBe('eager');
    expect(img?.getAttribute('fetchpriority')).toBe('high');
  });

  it('falls back to a plain img when there are no variants', () => {
    const { container } = renderVi(
      <ImageSlot
        alt="Alt"
        tint="#888"
        {...slotPhoto(photoFromUrl('https://cdn.test/one.webp', 'Alt', []))}
      />,
    );
    expect(container.querySelectorAll('source')).toHaveLength(0);
    expect(container.querySelector('img')?.getAttribute('src')).toBe('https://cdn.test/one.webp');
  });
});

describe('<ImageSlot> priority image from Storage', () => {
  const storage = 'https://ref.supabase.co/storage/v1/object/public/media/v';
  const variants: ImageVariant[] = [
    { format: 'avif', width: 640, height: 360, url: `${storage}/640.avif` },
    { format: 'webp', width: 640, height: 360, url: `${storage}/640.webp` },
  ];
  const view = photoFromUrl(`${storage}/640.webp`, 'Alt', variants);

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('serves the above-the-fold image from the web origin, and lazy images from Storage', () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://ref.supabase.co');
    const hero = renderVi(
      <ImageSlot alt="Alt" tint="#888" priority {...slotPhoto(view)} />,
    ).container;
    expect(hero.querySelector('img')?.getAttribute('src')).toBe('/media-cache/media/v/640.webp');
    expect(hero.querySelector('source[type="image/avif"]')?.getAttribute('srcset')).toBe(
      '/media-cache/media/v/640.avif 640w',
    );
    const lazy = renderVi(<ImageSlot alt="Alt" tint="#888" {...slotPhoto(view)} />).container;
    expect(lazy.querySelector('img')?.getAttribute('src')).toBe(`${storage}/640.webp`);
  });

  it('maps an in-viewport image eagerly without raising its fetch priority', () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://ref.supabase.co');
    const { container } = renderVi(
      <ImageSlot alt="Alt" tint="#888" inViewport {...slotPhoto(view)} />,
    );
    const img = container.querySelector('img');
    expect(img?.getAttribute('src')).toBe('/media-cache/media/v/640.webp');
    expect(img?.getAttribute('loading')).toBe('eager');
    expect(img?.getAttribute('fetchpriority')).toBeNull();
    expect(container.querySelector('source[type="image/avif"]')?.getAttribute('srcset')).toBe(
      '/media-cache/media/v/640.avif 640w',
    );
    expect(container.querySelector('source[type="image/webp"]')?.getAttribute('srcset')).toBe(
      '/media-cache/media/v/640.webp 640w',
    );
  });

  it('keeps the Storage URL when the project URL is not configured', () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '');
    const { container } = renderVi(
      <ImageSlot alt="Alt" tint="#888" priority {...slotPhoto(view)} />,
    );
    expect(container.querySelector('img')?.getAttribute('src')).toBe(`${storage}/640.webp`);
  });
});

describe('frameRatioOf', () => {
  const sized = (width: number, height: number): ImageVariant[] => [
    { format: 'webp', width, height, url: 'https://cdn.test/v/a.webp' },
  ];

  it('follows the image so it shows whole', () => {
    expect(frameRatioOf(sized(1280, 1707))).toBe('1280/1707');
    expect(frameRatioOf(sized(1280, 1600))).toBe('1280/1600');
  });

  it('falls back when there are no sizes, and clamps very tall or very wide files', () => {
    expect(frameRatioOf([])).toBe('4/5');
    expect(frameRatioOf(undefined, '1/1')).toBe('1/1');
    expect(frameRatioOf(sized(400, 1600))).toBe('3/5');
    expect(frameRatioOf(sized(3000, 600))).toBe('3/2');
  });
});

describe('<ImageSlot> fit', () => {
  it('fills the frame by default and shows the whole photo with fit="contain"', () => {
    const view = photoFromUrl('https://cdn.test/v/1280.webp', 'Alt', VARIANTS);
    const filled = renderVi(<ImageSlot alt="Alt" tint="#888" {...slotPhoto(view)} />).container;
    expect(filled.querySelector('img')?.className).toContain('object-cover');
    const whole = renderVi(
      <ImageSlot alt="Alt" tint="#888" fit="contain" {...slotPhoto(view)} />,
    ).container;
    expect(whole.querySelector('img')?.className).toContain('object-contain');
  });
});
