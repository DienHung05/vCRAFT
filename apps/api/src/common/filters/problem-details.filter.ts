import { MikroORM, OptimisticLockError, UniqueConstraintViolationException } from '@mikro-orm/core';
import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  Inject,
  Logger,
  Optional,
} from '@nestjs/common';
import {
  createProblem,
  type ErrorCode,
  isErrorCode,
  PROBLEM_CONTENT_TYPE,
  type ProblemDetails,
} from '@vcraft/contracts';
import { getDbPoolStats, isDbUnavailableError } from '@vcraft/database';
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
                : status === 503
                  ? 'SERVICE_UNAVAILABLE'
                  : status < 500
                    ? 'VALIDATION_MALFORMED_REQUEST'
                    : 'INTERNAL_ERROR';
  return createProblem({ code, status, detail: exception.message });
}

/** Seconds a client is told to wait before retrying after the database could not be reached. */
const DB_RETRY_AFTER_SECONDS = 2;
/** At most one "database unavailable" log line per this many ms, so an outage does not flood the log. */
const DB_UNAVAILABLE_LOG_INTERVAL_MS = 1_000;

/** Chuyển mọi lỗi thành Problem Details (RFC 9457, ARCHITECTURE §4.2). */
@Catch()
export class ProblemDetailsFilter implements ExceptionFilter {
  private readonly logger = new Logger(ProblemDetailsFilter.name);
  private lastDbLogAt = 0;

  /** The ORM is only used to report pool counters next to a "database unavailable" log line. */
  constructor(@Optional() @Inject(MikroORM) private readonly orm?: MikroORM) {}

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
    // Pool wait timed out, link dropped or pooler full: tell the client to retry instead of reporting a bug.
    if (isDbUnavailableError(exception)) {
      this.logDbUnavailable(exception);
      return createProblem({
        code: 'SERVICE_UNAVAILABLE',
        detail: 'The database is not reachable',
      });
    }
    this.logger.error(exception);
    return createProblem({ code: 'INTERNAL_ERROR' });
  }

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const reply = ctx.getResponse<HttpReply>();
    const request = ctx.getRequest<HttpRequest>();
    const problem = { ...this.toProblem(exception), instance: request.url };
    if (problem.code === 'SERVICE_UNAVAILABLE') {
      void reply.header('retry-after', String(DB_RETRY_AFTER_SECONDS));
    }
    void reply.status(problem.status).header('content-type', PROBLEM_CONTENT_TYPE).send(problem);
  }

  private logDbUnavailable(exception: unknown): void {
    const now = Date.now();
    if (now - this.lastDbLogAt < DB_UNAVAILABLE_LOG_INTERVAL_MS) return;
    this.lastDbLogAt = now;
    const reason = exception instanceof Error ? exception.message : String(exception);
    const orm = this.orm;
    const stats = orm ? getDbPoolStats(orm).catch(() => undefined) : Promise.resolve(undefined);
    void stats.then((pool) =>
      this.logger.warn(
        `Database unavailable (${reason}); pool: ${pool ? JSON.stringify(pool) : 'n/a'}`,
      ),
    );
  }
}
