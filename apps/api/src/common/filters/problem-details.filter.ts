import { OptimisticLockError, UniqueConstraintViolationException } from '@mikro-orm/core';
import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  Logger,
} from '@nestjs/common';
import {
  createProblem,
  type ErrorCode,
  isErrorCode,
  PROBLEM_CONTENT_TYPE,
  type ProblemDetails,
} from '@vcraft/contracts';
import { isDomainError } from '@vcraft/domain';
import { AppError } from '../errors/app-error';
import type { HttpReply, HttpRequest } from '../http/http-types';

/**
 * Mã lỗi domain → mã API. Mã domain trùng tên với `ERROR_CATALOG` (vd. `INVALID_TRANSITION`) dùng thẳng;
 * mã không có trong bảng thành `BUSINESS_RULE_VIOLATED` với `detail` là mã domain để FE vẫn phân biệt được.
 */
const DOMAIN_CODE_MAP: Readonly<Record<string, ErrorCode>> = {
  FORBIDDEN_ACTOR: 'AUTH_FORBIDDEN',
  EMAIL_NOT_VERIFIED: 'AUTH_EMAIL_NOT_VERIFIED',
  REASON_REQUIRED: 'VALIDATION_FAILED',
  MISSING_CONTEXT: 'VALIDATION_FAILED',
  JOURNAL_FROZEN: 'HOUSEHOLD_ACCOUNT_LOCKED',
};

function fromHttpException(exception: HttpException): ProblemDetails {
  const status = exception.getStatus();
  const code: ErrorCode =
    status === 401
      ? 'AUTH_UNAUTHENTICATED'
      : status === 403
        ? 'AUTH_FORBIDDEN'
        : status === 404
          ? 'NOT_FOUND'
          : status === 413
            ? 'MEDIA_TOO_LARGE'
            : status === 415
              ? 'MEDIA_UNSUPPORTED_TYPE'
              : status === 429
                ? 'RATE_LIMITED'
                : status < 500
                  ? 'VALIDATION_MALFORMED_REQUEST'
                  : 'INTERNAL_ERROR';
  return createProblem({ code, status, detail: exception.message });
}

/** Chuyển mọi lỗi thành Problem Details (RFC 9457, ARCHITECTURE §4.2). */
@Catch()
export class ProblemDetailsFilter implements ExceptionFilter {
  private readonly logger = new Logger(ProblemDetailsFilter.name);

  toProblem(exception: unknown): ProblemDetails {
    if (exception instanceof AppError) {
      return createProblem({
        code: exception.code,
        detail: exception.detail,
        errors: exception.errors,
      });
    }
    if (isDomainError(exception)) {
      const mapped = isErrorCode(exception.code)
        ? exception.code
        : (DOMAIN_CODE_MAP[exception.code] ?? 'BUSINESS_RULE_VIOLATED');
      return createProblem({
        code: mapped,
        detail: mapped === exception.code ? exception.message : exception.code,
      });
    }
    // Khóa lạc quan của MikroORM: bản ghi đã bị người khác sửa giữa lúc đọc và ghi (BR-L1)
    if (exception instanceof OptimisticLockError) {
      return createProblem({ code: 'STALE_VERSION' });
    }
    if (exception instanceof UniqueConstraintViolationException) {
      return createProblem({ code: 'CONFLICT_DUPLICATE' });
    }
    if (exception instanceof HttpException) return fromHttpException(exception);
    this.logger.error(exception);
    return createProblem({ code: 'INTERNAL_ERROR' });
  }

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const reply = ctx.getResponse<HttpReply>();
    const request = ctx.getRequest<HttpRequest>();
    const problem = { ...this.toProblem(exception), instance: request.url };
    void reply.status(problem.status).header('content-type', PROBLEM_CONTENT_TYPE).send(problem);
  }
}
