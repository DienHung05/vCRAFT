import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import { AppError } from '../errors/app-error';
import type { HttpRequest } from './http-types';

/** Đọc `If-Match: <version>` (chấp nhận cả dạng ETag `"5"` / `W/"5"`). Thiếu ⇒ 428 `VERSION_REQUIRED` (BR-L1). */
export function parseIfMatch(raw: string | string[] | undefined): number {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (value === undefined || value.trim() === '') throw new AppError('VERSION_REQUIRED');
  const digits = value.trim().replace(/^W\//, '').replaceAll('"', '');
  const version = Number(digits);
  if (!Number.isInteger(version) || version < 0) {
    throw new AppError('VALIDATION_MALFORMED_REQUEST', 'If-Match must be a version number');
  }
  return version;
}

export const IfMatchVersion = createParamDecorator((_data: unknown, ctx: ExecutionContext) =>
  parseIfMatch(ctx.switchToHttp().getRequest<HttpRequest>().headers['if-match']),
);
