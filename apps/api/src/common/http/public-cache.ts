import { createHash } from 'node:crypto';
import type { HttpReply, HttpRequest } from './http-types';

/** Trang công khai cho phép CDN/trình duyệt giữ ngắn hạn; sau đó xác nhận lại bằng ETag (304). */
export const PUBLIC_CACHE_CONTROL = 'public, max-age=60, stale-while-revalidate=300';

function etagOf(payload: unknown): string {
  const digest = createHash('sha1').update(JSON.stringify(payload)).digest('base64url');
  return `W/"${digest}"`;
}

function matches(header: string | string[] | undefined, etag: string): boolean {
  if (header === undefined) return false;
  const raw = Array.isArray(header) ? header.join(',') : header;
  return raw.split(',').some((candidate) => {
    const tag = candidate.trim();
    return tag === '*' || tag.replace(/^W\//, '') === etag.replace(/^W\//, '');
  });
}

/**
 * Gắn `Cache-Control` công khai và `ETag` (băm nội dung) cho phản hồi GET công khai. Nếu client gửi
 * `If-None-Match` khớp thì trả 304 không thân, ngược lại trả nguyên `payload`.
 */
export function withPublicCache<T>(
  request: HttpRequest,
  reply: HttpReply,
  payload: T,
): T | undefined {
  const etag = etagOf(payload);
  reply.header('Cache-Control', PUBLIC_CACHE_CONTROL).header('ETag', etag);
  if (matches(request.headers['if-none-match'], etag)) {
    reply.status(304);
    return undefined;
  }
  return payload;
}
