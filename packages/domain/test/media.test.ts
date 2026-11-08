import { describe, expect, it } from 'vitest';
import {
  checkMediaUpload,
  MEDIA_MAX_BYTES,
  MEDIA_MAX_PIXELS,
  planVariantWidths,
  readImageSize,
  visibilityOf,
} from '../src';

const jpeg = { declaredMime: 'image/jpeg', sniffedMime: 'image/jpeg', sizeBytes: 1_500_000 };

describe('luật upload media', () => {
  it('ảnh nhật ký hợp lệ đi bucket công khai qua bước chuyển đổi', () => {
    const result = checkMediaUpload({ purpose: 'JOURNAL', ...jpeg });
    expect(result).toEqual({
      ok: true,
      value: { mime: 'image/jpeg', visibility: 'PUBLIC', convert: true },
    });
  });

  it('giấy chứng nhận là riêng tư, nhận cả PDF và không chuyển đổi', () => {
    expect(visibilityOf('CERTIFICATE')).toBe('PRIVATE');
    const result = checkMediaUpload({
      purpose: 'CERTIFICATE',
      declaredMime: 'application/pdf',
      sniffedMime: 'application/pdf',
      sizeBytes: 300_000,
    });
    expect(result).toEqual({
      ok: true,
      value: { mime: 'application/pdf', visibility: 'PRIVATE', convert: false },
    });
  });

  it('PDF không được làm ảnh công khai', () => {
    const result = checkMediaUpload({
      purpose: 'PRODUCT',
      declaredMime: 'application/pdf',
      sniffedMime: 'application/pdf',
      sizeBytes: 300_000,
    });
    expect(!result.ok && result.error.code).toBe('MEDIA_UNSUPPORTED_TYPE');
  });

  it('loại thật lấy từ magic bytes: khai image/png nhưng nội dung là HTML thì từ chối', () => {
    const unknown = checkMediaUpload({
      purpose: 'JOURNAL',
      declaredMime: 'image/png',
      sniffedMime: undefined,
      sizeBytes: 2_000,
    });
    expect(!unknown.ok && unknown.error.code).toBe('MEDIA_UNSUPPORTED_TYPE');
  });

  it('khai một loại ảnh nhưng nội dung là loại ảnh khác cũng bị từ chối', () => {
    const result = checkMediaUpload({ purpose: 'JOURNAL', ...jpeg, declaredMime: 'image/png' });
    expect(!result.ok && result.error.code).toBe('MEDIA_UNSUPPORTED_TYPE');
  });

  it('chấp nhận tên gọi khác của JPEG và tham số sau dấu chấm phẩy', () => {
    const result = checkMediaUpload({ purpose: 'JOURNAL', ...jpeg, declaredMime: 'image/jpg' });
    expect(result.ok).toBe(true);
    const withParam = checkMediaUpload({
      purpose: 'JOURNAL',
      ...jpeg,
      declaredMime: 'IMAGE/JPEG; charset=binary',
    });
    expect(withParam.ok).toBe(true);
  });

  it('SVG không bao giờ được nhận', () => {
    const result = checkMediaUpload({
      purpose: 'PRODUCT',
      declaredMime: 'image/svg+xml',
      sniffedMime: 'image/svg+xml',
      sizeBytes: 900,
    });
    expect(!result.ok && result.error.code).toBe('MEDIA_UNSUPPORTED_TYPE');
  });

  it('kích thước: đúng giới hạn thì nhận, vượt một byte thì từ chối, tệp rỗng thì từ chối', () => {
    expect(checkMediaUpload({ purpose: 'JOURNAL', ...jpeg, sizeBytes: MEDIA_MAX_BYTES }).ok).toBe(
      true,
    );
    const tooLarge = checkMediaUpload({
      purpose: 'JOURNAL',
      ...jpeg,
      sizeBytes: MEDIA_MAX_BYTES + 1,
    });
    expect(!tooLarge.ok && tooLarge.error.code).toBe('MEDIA_TOO_LARGE');
    const empty = checkMediaUpload({ purpose: 'JOURNAL', ...jpeg, sizeBytes: 0 });
    expect(!empty.ok && empty.error.code).toBe('MEDIA_UNSUPPORTED_TYPE');
  });
});

describe('mốc biến thể ảnh', () => {
  it('không phóng to: chỉ sinh các mốc không vượt ảnh gốc', () => {
    expect(planVariantWidths(4032)).toEqual([320, 640, 1280, 2048]);
    expect(planVariantWidths(1280)).toEqual([320, 640, 1280]);
    expect(planVariantWidths(1000)).toEqual([320, 640]);
  });

  it('ảnh nhỏ hơn mốc nhỏ nhất vẫn có một biến thể bằng kích thước gốc', () => {
    expect(planVariantWidths(200)).toEqual([200]);
  });
});

describe('request attachments', () => {
  it('are private and accept an image or a PDF without conversion', () => {
    expect(visibilityOf('RFQ_ATTACHMENT')).toBe('PRIVATE');
    const result = checkMediaUpload({
      purpose: 'RFQ_ATTACHMENT',
      declaredMime: 'application/pdf',
      sniffedMime: 'application/pdf',
      sizeBytes: 200_000,
    });
    expect(result).toEqual({
      ok: true,
      value: { mime: 'application/pdf', visibility: 'PRIVATE', convert: false },
    });
  });
});

describe('HEIC, 15 MiB and resolution (GH#252)', () => {
  it('the size limit is 15 MiB', () => {
    expect(MEDIA_MAX_BYTES).toBe(15 * 1024 * 1024);
    expect(MEDIA_MAX_PIXELS).toBe(50_000_000);
  });

  it('accepts a public HEIC/HEIF photo and converts it', () => {
    for (const mime of ['image/heic', 'image/heif']) {
      expect(
        checkMediaUpload({
          purpose: 'PRODUCT',
          declaredMime: mime,
          sniffedMime: mime,
          sizeBytes: 3_000_000,
        }),
      ).toEqual({ ok: true, value: { mime, visibility: 'PUBLIC', convert: true } });
    }
  });

  it('treats image/heic declared for a heif-branded file as the same type', () => {
    const result = checkMediaUpload({
      purpose: 'JOURNAL',
      declaredMime: 'image/heic',
      sniffedMime: 'image/heif',
      sizeBytes: 3_000_000,
    });
    expect(result.ok).toBe(true);
  });

  it('keeps HEIC out of private documents, which are never converted', () => {
    const result = checkMediaUpload({
      purpose: 'CERTIFICATE',
      declaredMime: 'image/heic',
      sniffedMime: 'image/heic',
      sizeBytes: 3_000_000,
    });
    expect(!result.ok && result.error.code).toBe('MEDIA_UNSUPPORTED_TYPE');
  });

  it('accepts exactly 50 megapixels and refuses one pixel more', () => {
    const at = checkMediaUpload({
      purpose: 'PRODUCT',
      ...jpeg,
      dimensions: { width: 10_000, height: 5_000 },
    });
    expect(at.ok).toBe(true);
    const over = checkMediaUpload({
      purpose: 'PRODUCT',
      ...jpeg,
      dimensions: { width: 10_001, height: 5_000 },
    });
    expect(!over.ok && over.error.code).toBe('MEDIA_RESOLUTION_TOO_HIGH');
  });

  it('skips the resolution check when the header could not be read', () => {
    expect(checkMediaUpload({ purpose: 'PRODUCT', ...jpeg, dimensions: undefined }).ok).toBe(true);
  });
});

describe('readImageSize', () => {
  const u32 = (n: number) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
  const text = (value: string) => [...value].map((c) => c.charCodeAt(0));

  it('reads a PNG header', () => {
    const bytes = new Uint8Array([
      0x89,
      ...text('PNG\r\n'),
      0x1a,
      0x0a,
      ...u32(13),
      ...text('IHDR'),
      ...u32(7000),
      ...u32(7000),
      8,
      6,
      0,
      0,
      0,
    ]);
    expect(readImageSize(bytes)).toEqual({ width: 7000, height: 7000 });
  });

  it('reads a JPEG start-of-frame after other segments', () => {
    const bytes = new Uint8Array([
      0xff, 0xd8, 0xff, 0xe0, 0x00, 0x04, 0x4a, 0x46, 0xff, 0xc0, 0x00, 0x0b, 0x08, 0x0b, 0xb8,
      0x0f, 0xa0, 0x01, 0x01, 0x11, 0x00,
    ]);
    expect(readImageSize(bytes)).toEqual({ width: 4000, height: 3000 });
  });

  it('reads a lossy-extended WebP header', () => {
    const bytes = new Uint8Array([
      ...text('RIFF'),
      0,
      0,
      0,
      0,
      ...text('WEBPVP8X'),
      10,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      ...[0x9f, 0x0f, 0x00],
      ...[0xff, 0x0b, 0x00],
    ]);
    expect(readImageSize(bytes)).toEqual({ width: 4000, height: 3072 });
  });

  it('reads the largest ispe box of a HEIC file', () => {
    const ispe = (w: number, h: number) => [
      ...u32(20),
      ...text('ispe'),
      0,
      0,
      0,
      0,
      ...u32(w),
      ...u32(h),
    ];
    const bytes = new Uint8Array([
      ...u32(24),
      ...text('ftypheic'),
      0,
      0,
      0,
      0,
      ...text('heic'),
      ...ispe(512, 512),
      ...ispe(4032, 3024),
    ]);
    expect(readImageSize(bytes)).toEqual({ width: 4032, height: 3024 });
  });

  it('returns undefined for unknown or truncated data', () => {
    expect(readImageSize(new Uint8Array([1, 2, 3]))).toBeUndefined();
    expect(readImageSize(new Uint8Array([0x89, 0x50, 0x4e]))).toBeUndefined();
  });
});
