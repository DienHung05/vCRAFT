import { DomainError } from '../shared/domain-error';
import { err, ok, type Result } from '../shared/result';

/**
 * Upload media (FR-MEDIA-03/04, ADR-14). Tầng API dò magic bytes rồi hỏi luật ở đây; luật không
 * tin `Content-Type` client gửi: loại thật lấy từ magic bytes, khai báo sai loại thì từ chối.
 */
export const MEDIA_PURPOSES = ['JOURNAL', 'PRODUCT', 'CERTIFICATE', 'RFQ_ATTACHMENT'] as const;
export type MediaPurpose = (typeof MEDIA_PURPOSES)[number];

/** What a private CERTIFICATE document evidences (vCRAFT-8my.3). */
export const CERTIFICATE_KINDS = ['IDENTITY', 'RESIDENCE', 'WORKSHOP', 'UNKNOWN'] as const;
export type CertificateKind = (typeof CERTIFICATE_KINDS)[number];

export type MediaVisibility = 'PUBLIC' | 'PRIVATE';

/** Khớp `file_size_limit` của hai bucket (10 MB); client nén ảnh điện thoại trước khi gửi. */
export const MEDIA_MAX_BYTES = 10 * 1024 * 1024;

/** Chặn ảnh "bom giải nén": số điểm ảnh tối đa worker chịu decode. */
export const MEDIA_MAX_PIXELS = 40_000_000;

/** Bề ngang các biến thể AVIF/WebP (ARCHITECTURE §7.1). */
export const MEDIA_VARIANT_WIDTHS = [320, 640, 1280, 2048] as const;

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'] as const;
/** Giấy tờ chứng nhận có thể là bản scan PDF; không bao giờ có SVG (ADR-14). */
const PRIVATE_TYPES = [...IMAGE_TYPES, 'application/pdf'] as const;

export type MediaUploadErrorCode = 'MEDIA_TOO_LARGE' | 'MEDIA_UNSUPPORTED_TYPE';

export interface MediaUploadFacts {
  readonly purpose: MediaPurpose;
  /** `Content-Type` client khai cho phần file. */
  readonly declaredMime: string;
  /** Loại dò từ magic bytes; `undefined` khi không nhận ra. */
  readonly sniffedMime: string | undefined;
  readonly sizeBytes: number;
}

export interface MediaUploadPlan {
  readonly mime: string;
  readonly visibility: MediaVisibility;
  /** Ảnh công khai đi qua worker để xóa EXIF và sinh biến thể; tệp riêng tư giữ nguyên bản gốc. */
  readonly convert: boolean;
}

/**
 * Giấy chứng nhận chỉ Ban quản lý xem (FR-MEDIA-04); ảnh nhật ký và sản phẩm là công khai. Tệp đính kèm của
 * yêu cầu báo giá (logo, bản vẽ; FR-RFQ-01) là riêng tư: chỉ người mua, Ban quản lý và các hộ được mời đọc.
 */
export function visibilityOf(purpose: MediaPurpose): MediaVisibility {
  return purpose === 'CERTIFICATE' || purpose === 'RFQ_ATTACHMENT' ? 'PRIVATE' : 'PUBLIC';
}

function normalizeMime(mime: string): string {
  const base = mime.split(';')[0]?.trim().toLowerCase() ?? '';
  return base === 'image/jpg' || base === 'image/pjpeg' ? 'image/jpeg' : base;
}

export function checkMediaUpload(
  facts: MediaUploadFacts,
): Result<MediaUploadPlan, DomainError<MediaUploadErrorCode>> {
  if (facts.sizeBytes > MEDIA_MAX_BYTES) {
    return err(
      new DomainError('MEDIA_TOO_LARGE', `file exceeds ${MEDIA_MAX_BYTES} bytes`, {
        maxBytes: MEDIA_MAX_BYTES,
      }),
    );
  }
  const visibility = visibilityOf(facts.purpose);
  const allowed: readonly string[] = visibility === 'PRIVATE' ? PRIVATE_TYPES : IMAGE_TYPES;
  const sniffed = facts.sniffedMime === undefined ? undefined : normalizeMime(facts.sniffedMime);
  if (facts.sizeBytes === 0 || !sniffed || !allowed.includes(sniffed)) {
    return err(new DomainError('MEDIA_UNSUPPORTED_TYPE', 'content is not an allowed type'));
  }
  if (normalizeMime(facts.declaredMime) !== sniffed) {
    return err(
      new DomainError('MEDIA_UNSUPPORTED_TYPE', 'declared type does not match content', {
        declared: facts.declaredMime,
        detected: sniffed,
      }),
    );
  }
  return ok({ mime: sniffed, visibility, convert: visibility === 'PUBLIC' });
}

/**
 * Bề ngang cần sinh cho một ảnh: mọi mốc không vượt ảnh gốc (không phóng to). Ảnh nhỏ hơn mốc
 * nhỏ nhất vẫn có đúng một biến thể bằng kích thước gốc.
 */
export function planVariantWidths(originalWidth: number): number[] {
  const widths = MEDIA_VARIANT_WIDTHS.filter((width) => width <= originalWidth);
  return widths.length > 0 ? widths : [Math.max(1, Math.floor(originalWidth))];
}
