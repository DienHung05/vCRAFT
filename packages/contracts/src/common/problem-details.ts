import { z } from 'zod';
import { defaultStatusOf, defaultTitleOf, ERROR_CODE_LIST, type ErrorCode } from './error-codes';

/**
 * Lỗi theo field cho form (ARCHITECTURE §4.2: `errors?: [{ path, message }]`).
 * - `path`: đường dẫn dạng chấm, khớp tên field của form (`items.0.quantity`); `''` = lỗi cấp object.
 * - `message`: thông điệp tiếng Việt, hiển thị trực tiếp được (NFR-UX-05).
 * - `code`: mã máy đọc được (mã issue của Zod hoặc mã tự đặt) để FE tra i18n nếu muốn.
 */
export const FieldErrorSchema = z.object({
  path: z.string(),
  message: z.string(),
  code: z.string(),
});
export type FieldError = z.infer<typeof FieldErrorSchema>;

export const ErrorCodeSchema = z.enum(ERROR_CODE_LIST);

/**
 * Problem Details theo RFC 9457 (`Content-Type: application/problem+json`) + phần mở rộng của vCraft.
 * - `type`: URI-reference định danh loại lỗi (xem {@link problemTypeOf}).
 * - `code`: mã lỗi ổn định (xem `error-codes.ts`), FE dựa vào đây chứ không dựa `title`.
 * - `traceId`: khớp `requestId` trong log (ARCHITECTURE §10) để truy vết.
 */
export const ProblemDetailsSchema = z.object({
  type: z.string().min(1),
  title: z.string().min(1),
  status: z.int().min(400).max(599),
  detail: z.string().optional(),
  instance: z.string().optional(),
  code: ErrorCodeSchema,
  errors: z.array(FieldErrorSchema).optional(),
  traceId: z.string().optional(),
});
export type ProblemDetails = z.infer<typeof ProblemDetailsSchema>;

/** Media type của phản hồi lỗi. */
export const PROBLEM_CONTENT_TYPE = 'application/problem+json';

/** `STALE_VERSION` -> `/problems/stale-version` (URI-reference tương đối, RFC 9457 §3.1.1). */
export function problemTypeOf(code: ErrorCode): string {
  return `/problems/${code.toLowerCase().replaceAll('_', '-')}`;
}

export interface CreateProblemInput {
  code: ErrorCode;
  detail?: string | undefined;
  instance?: string | undefined;
  errors?: FieldError[] | undefined;
  traceId?: string | undefined;
  /** Ghi đè HTTP status mặc định của mã lỗi. */
  status?: number | undefined;
  /** Ghi đè title mặc định. */
  title?: string | undefined;
}

/** Dựng Problem Details từ mã lỗi; `status`/`title`/`type` lấy mặc định từ danh mục. */
export function createProblem(input: CreateProblemInput): ProblemDetails {
  const { code, detail, instance, errors, traceId } = input;
  return {
    type: problemTypeOf(code),
    title: input.title ?? defaultTitleOf(code),
    status: input.status ?? defaultStatusOf(code),
    code,
    ...(detail !== undefined && { detail }),
    ...(instance !== undefined && { instance }),
    ...(errors !== undefined && errors.length > 0 && { errors }),
    ...(traceId !== undefined && { traceId }),
  };
}

/** Kiểm tra dữ liệu (vd. JSON từ response lỗi) có đúng dạng Problem Details của vCraft không. */
export function isProblemDetails(value: unknown): value is ProblemDetails {
  return ProblemDetailsSchema.safeParse(value).success;
}
