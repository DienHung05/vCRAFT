import { z } from 'zod';

/** Tên header dùng chung FE/BE (ARCHITECTURE §4.2, BR-L1, BR-L5). */
export const HTTP_HEADERS = {
  idempotencyKey: 'Idempotency-Key',
  ifMatch: 'If-Match',
  ifNoneMatch: 'If-None-Match',
  etag: 'ETag',
  retryAfter: 'Retry-After',
  traceId: 'X-Request-Id',
} as const;

/** BR-L5: `Idempotency-Key` do client sinh (khuyến nghị UUID), 8-128 ký tự in được. */
export const IdempotencyKeySchema = z
  .string()
  .min(8)
  .max(128)
  .regex(/^[\x21-\x7e]+$/, 'Idempotency-Key chỉ gồm ký tự ASCII in được, không có khoảng trắng');

/**
 * BR-L1: đọc phiên bản từ `If-Match`. Chấp nhận `5`, `"5"`, `W/"5"`, `v5`.
 * Trả `null` khi thiếu hoặc sai dạng (endpoint trả `VERSION_REQUIRED` / `VALIDATION_FAILED`).
 */
export function parseIfMatch(header: string | null | undefined): number | null {
  if (!header) return null;
  const match = /^\s*(?:W\/)?"?v?(\d+)"?\s*$/.exec(header);
  if (!match?.[1]) return null;
  const version = Number(match[1]);
  return Number.isSafeInteger(version) ? version : null;
}

/** Dựng giá trị `ETag`/`If-Match` từ số phiên bản: `5` -> `"5"`. */
export function formatVersionTag(version: number): string {
  return `"${version}"`;
}
