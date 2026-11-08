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

/** 15 MiB per file (NFR-SEC-05); must match `file_size_limit` of both Supabase buckets. */
export const MEDIA_MAX_BYTES = 15 * 1024 * 1024;

/** Chặn ảnh "bom giải nén": số điểm ảnh tối đa (50 MP) mà API nhận và worker chịu decode. */
export const MEDIA_MAX_PIXELS = 50_000_000;

/** Bề ngang các biến thể AVIF/WebP (ARCHITECTURE §7.1). */
export const MEDIA_VARIANT_WIDTHS = [320, 640, 1280, 2048] as const;

const WEB_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'] as const;
/**
 * Phone photos (FR-PRD-02). Only public images are accepted in HEIC/HEIF because the worker converts them;
 * browsers cannot show them, so private documents (never converted) stay on the web formats.
 */
const HEIC_TYPES = ['image/heic', 'image/heif'] as const;
const IMAGE_TYPES = [...WEB_IMAGE_TYPES, ...HEIC_TYPES] as const;
/** Giấy tờ chứng nhận có thể là bản scan PDF; không bao giờ có SVG (ADR-14). */
const PRIVATE_TYPES = [...WEB_IMAGE_TYPES, 'application/pdf'] as const;

/** True for the HEIC/HEIF family, which the worker decodes with a JS decoder (sharp has no HEVC). */
export const isHeicMime = (mime: string): boolean => /^image\/hei[cf](-sequence)?$/i.test(mime);

export type MediaUploadErrorCode =
  | 'MEDIA_TOO_LARGE'
  | 'MEDIA_RESOLUTION_TOO_HIGH'
  | 'MEDIA_UNSUPPORTED_TYPE';

export interface MediaUploadFacts {
  readonly purpose: MediaPurpose;
  /** `Content-Type` client khai cho phần file. */
  readonly declaredMime: string;
  /** Loại dò từ magic bytes; `undefined` khi không nhận ra. */
  readonly sniffedMime: string | undefined;
  readonly sizeBytes: number;
  /** Pixel size read from the file header, when it could be read cheaply. */
  readonly dimensions?: { readonly width: number; readonly height: number } | undefined;
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

/** Phones declare `image/heic` for files whose brand sniffs as `image/heif` (and the other way round). */
const sameType = (declared: string, sniffed: string) =>
  declared === sniffed || (isHeicMime(declared) && isHeicMime(sniffed));

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
  if (!sameType(normalizeMime(facts.declaredMime), sniffed)) {
    return err(
      new DomainError('MEDIA_UNSUPPORTED_TYPE', 'declared type does not match content', {
        declared: facts.declaredMime,
        detected: sniffed,
      }),
    );
  }
  const { dimensions } = facts;
  if (dimensions && dimensions.width * dimensions.height > MEDIA_MAX_PIXELS) {
    return err(
      new DomainError('MEDIA_RESOLUTION_TOO_HIGH', `image exceeds ${MEDIA_MAX_PIXELS} pixels`, {
        maxPixels: MEDIA_MAX_PIXELS,
        width: dimensions.width,
        height: dimensions.height,
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
