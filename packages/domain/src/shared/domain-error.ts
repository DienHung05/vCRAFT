/**
 * Lỗi nghiệp vụ có kiểu (SRS §4.1: lỗi `409 INVALID_TRANSITION`, RFC 9457).
 * `code` là khóa ổn định để tầng API ánh xạ sang Problem Details và tầng UI tra từ điển i18n;
 * `message` chỉ dành cho nhà phát triển/log, không hiển thị trực tiếp cho người dùng.
 */
export class DomainError<C extends string = string> extends Error {
  readonly code: C;
  readonly details: Readonly<Record<string, unknown>> | undefined;

  constructor(code: C, message: string, details?: Readonly<Record<string, unknown>>) {
    super(message);
    this.name = 'DomainError';
    this.code = code;
    this.details = details;
  }
}

export function isDomainError(value: unknown): value is DomainError {
  return value instanceof DomainError;
}
