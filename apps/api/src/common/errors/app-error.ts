import type { ErrorCode, FieldError } from '@vcraft/contracts';

/**
 * Lỗi tầng ứng dụng mang mã ổn định của `ERROR_CATALOG`; `ProblemDetailsFilter` đổi thành RFC 9457.
 * Domain ném/ trả `DomainError` (mã nghiệp vụ); service ném `AppError` cho lỗi thuộc tầng ứng dụng
 * (không tìm thấy, phiên bản cũ, không đủ quyền theo quan hệ sở hữu...).
 */
export class AppError extends Error {
  constructor(
    readonly code: ErrorCode,
    readonly detail?: string,
    readonly errors?: FieldError[],
  ) {
    super(detail ?? code);
    this.name = 'AppError';
  }
}

export const notFound = (detail?: string) => new AppError('NOT_FOUND', detail);
export const forbidden = (detail?: string) => new AppError('AUTH_FORBIDDEN', detail);
