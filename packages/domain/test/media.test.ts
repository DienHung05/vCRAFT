import { describe, expect, it } from 'vitest';
import { checkMediaUpload, MEDIA_MAX_BYTES, planVariantWidths, visibilityOf } from '../src';

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
