import { z } from 'zod';
import { createProblem, type FieldError, type ProblemDetails } from './problem-details';

/** Nối `PropertyKey[]` của Zod thành đường dẫn chấm: `['items', 0, 'qty']` -> `items.0.qty`. */
export function issuePath(path: readonly PropertyKey[]): string {
  return path.map((segment) => String(segment)).join('.');
}

export interface ZodToFieldErrorsOptions {
  /**
   * Đổi thông điệp của một issue (vd. tra `packages/i18n` ở tầng gọi).
   * Mặc định dùng `issue.message` (đã là tiếng Việt khi gọi {@link applyVietnameseZodErrors}
   * hoặc schema tự đặt message). contracts không import `packages/i18n`.
   */
  formatMessage?: ((issue: z.core.$ZodIssue) => string) | undefined;
}

/**
 * ZodError -> `errors[]` của Problem Details. Mỗi issue một phần tử; `unrecognized_keys`
 * được tách theo từng key để form gắn lỗi đúng field. Lỗi trùng (path + code + message) bị loại.
 */
export function zodErrorToFieldErrors(
  error: z.core.$ZodError,
  options: ZodToFieldErrorsOptions = {},
): FieldError[] {
  const seen = new Set<string>();
  const result: FieldError[] = [];

  const push = (field: FieldError) => {
    const key = `${field.path}\u0000${field.code}\u0000${field.message}`;
    if (seen.has(key)) return;
    seen.add(key);
    result.push(field);
  };

  for (const issue of error.issues) {
    const message = options.formatMessage?.(issue) ?? issue.message;
    if (issue.code === 'unrecognized_keys') {
      for (const key of issue.keys) {
        push({ path: issuePath([...issue.path, key]), message, code: issue.code });
      }
      continue;
    }
    push({ path: issuePath(issue.path), message, code: issue.code });
  }
  return result;
}

export interface ZodToProblemOptions extends ZodToFieldErrorsOptions {
  instance?: string | undefined;
  traceId?: string | undefined;
  detail?: string | undefined;
}

/** ZodError -> Problem Details `422 VALIDATION_FAILED` kèm `errors[]` theo field. */
export function zodErrorToProblem(
  error: z.core.$ZodError,
  options: ZodToProblemOptions = {},
): ProblemDetails {
  return createProblem({
    code: 'VALIDATION_FAILED',
    detail:
      options.detail ?? 'Dữ liệu gửi lên chưa hợp lệ. Vui lòng kiểm tra các trường được đánh dấu.',
    instance: options.instance,
    traceId: options.traceId,
    errors: zodErrorToFieldErrors(error, options),
  });
}
