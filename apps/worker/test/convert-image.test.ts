import decodeHeic from 'heic-decode';
import sharp from 'sharp';
import { describe, expect, it, vi } from 'vitest';
import { convertImage, convertImageInPhases } from '../src/processors/media/convert-image';

// sharp's prebuilt libvips cannot read HEVC, so HEIC goes through a JS decoder; the tests feed it raw pixels.
vi.mock('heic-decode', () => ({ default: vi.fn() }));

/** Ảnh "điện thoại": dải màu + nhiễu nhẹ, chụp dọc (EXIF Orientation 6), có GPS. */
async function phonePhoto(width: number, height: number): Promise<Buffer> {
  const pixels = Buffer.alloc(width * height * 3);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 3;
      const noise = (x * 7919 + y * 104_729) % 23;
      pixels[i] = (x * 255) / width + noise;
      pixels[i + 1] = (y * 255) / height + noise;
      pixels[i + 2] = 140 + noise;
    }
  return (
    sharp(pixels, { raw: { width, height, channels: 3 } })
      .withExif({
        IFD0: { Make: 'TestPhone', Model: 'Bat Trang' },
        IFD3: { GPSLatitudeRef: 'N', GPSLatitude: '20/1 58/1 32/1' },
      })
      // `withExif` bỏ qua Orientation; sharp chỉ ghi thẻ này qua `withMetadata`
      .withMetadata({ orientation: 6 })
      .jpeg({ quality: 100, chromaSubsampling: '4:4:4' })
      .toBuffer()
  );
}

describe('convertImage', () => {
  it('xoay theo EXIF, xóa metadata, sinh AVIF + WebP theo mốc bề ngang', async () => {
    const input = await phonePhoto(3000, 2000);
    const inputMeta = await sharp(input).metadata();
    expect(inputMeta.exif).toBeDefined();
    expect(inputMeta.orientation).toBe(6);

    const result = await convertImage(new Uint8Array(input));

    // Orientation 6 = xoay 90°: ảnh dọc sau khi chuẩn hóa
    expect({ width: result.width, height: result.height }).toEqual({ width: 2000, height: 3000 });
    expect(result.variants.map((v) => `${v.width}.${v.format}`)).toEqual([
      '320.avif',
      '320.webp',
      '640.avif',
      '640.webp',
      '1280.avif',
      '1280.webp',
    ]);
    for (const variant of result.variants) {
      const meta = await sharp(variant.bytes).metadata();
      expect(meta.format).toBe(variant.format === 'avif' ? 'heif' : 'webp');
      expect(meta.exif).toBeUndefined();
      expect(meta.orientation ?? 1).toBe(1);
      expect(variant.height).toBe(Math.round((variant.width * 3000) / 2000));
      expect(variant.hash).toMatch(/^[0-9a-f]{16}$/);
    }
    expect(result.thumbhash.length).toBeGreaterThan(10);
    expect(result.dominantColor).toMatch(/^#[0-9a-f]{6}$/);
  });

  it('biến thể lớn nhất của ảnh điện thoại nhỏ hơn 1.5 MB', async () => {
    const input = await phonePhoto(4032, 3024);
    const result = await convertImage(new Uint8Array(input));
    const largest = Math.max(...result.variants.map((v) => v.bytes.byteLength));
    expect(result.variants.some((v) => v.width === 2048)).toBe(true);
    expect(largest).toBeLessThan(1.5 * 1024 * 1024);
  });

  it('nội dung không decode được thì ném lỗi', async () => {
    await expect(convertImage(new Uint8Array([0xff, 0xd8, 0xff, 0x00, 1, 2, 3]))).rejects.toThrow();
  });

  it('returns the WebP sizes before the slow AVIF phase (GH#252)', async () => {
    const input = await phonePhoto(1000, 1400);
    const phased = await convertImageInPhases(new Uint8Array(input));
    expect(phased.webp.map((v) => `${v.width}.${v.format}`)).toEqual([
      '320.webp',
      '640.webp',
      '1280.webp',
    ]);
    expect(phased.thumbhash.length).toBeGreaterThan(10);
    const avif = await phased.encodeAvif();
    expect(avif.map((v) => `${v.width}.${v.format}`)).toEqual([
      '320.avif',
      '640.avif',
      '1280.avif',
    ]);
  });

  it('decodes HEIC with the JS decoder and converts it like any other photo', async () => {
    const width = 800;
    const height = 600;
    const data = new Uint8ClampedArray(width * height * 4);
    for (let i = 0; i < data.length; i += 4) {
      data[i] = (i / 4) % 255;
      data[i + 1] = 120;
      data[i + 2] = 60;
      data[i + 3] = 255;
    }
    vi.mocked(decodeHeic).mockResolvedValueOnce({ width, height, data });

    const result = await convertImage(new Uint8Array([0, 0, 0, 24]), { heic: true });

    expect({ width: result.width, height: result.height }).toEqual({ width, height });
    expect(result.variants.map((v) => `${v.width}.${v.format}`)).toEqual([
      '320.avif',
      '320.webp',
      '640.avif',
      '640.webp',
    ]);
    expect((await sharp(result.variants[1]?.bytes).metadata()).format).toBe('webp');
  });

  it('refuses a HEIC above the pixel limit before converting it', async () => {
    vi.mocked(decodeHeic).mockResolvedValueOnce({
      width: 8000,
      height: 7000,
      data: new Uint8ClampedArray(0),
    });
    await expect(convertImage(new Uint8Array([0, 0, 0, 24]), { heic: true })).rejects.toThrow(
      /pixels/,
    );
  });
});
