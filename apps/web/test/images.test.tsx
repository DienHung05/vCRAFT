import { describe, expect, it } from 'vitest';
import { ImageSlot } from '@/components/image-slot';
import { photoFromUrl, slotPhoto } from '@/features/catalog/view-models';
import { buildResponsiveImage, type ImageVariant } from '@/lib/images';
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
