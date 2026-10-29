import type { Result } from '@vcraft/domain';
import { AppError } from '../errors/app-error';

/** Lấy giá trị của `Result` domain; lỗi thì ném `DomainError` để `ProblemDetailsFilter` đổi thành 4xx. */
export function unwrap<T, E extends Error>(result: Result<T, E>): T {
  if (!result.ok) throw result.error;
  return result.value;
}

/** BR-L1: phiên bản client gửi (`If-Match`) phải khớp bản đang lưu, nếu không ⇒ 409 `STALE_VERSION`. */
export function assertVersion(entity: { version: number }, expected: number): void {
  if (entity.version !== expected) {
    throw new AppError('STALE_VERSION', `current version is ${entity.version}`);
  }
}
