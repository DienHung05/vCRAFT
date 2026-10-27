import { z } from 'zod';

export const DEFAULT_PAGE_LIMIT = 24;
export const MAX_PAGE_LIMIT = 100;

/**
 * Phân trang con trỏ (ARCHITECTURE §4.2, không OFFSET): `?cursor=…&limit=24`.
 * `cursor` là chuỗi mờ (opaque) do server sinh; client chỉ gửi lại nguyên văn.
 */
export const CursorPageQuerySchema = z.object({
  cursor: z.string().min(1).max(512).optional(),
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_LIMIT).default(DEFAULT_PAGE_LIMIT),
});
export type CursorPageQuery = z.infer<typeof CursorPageQuerySchema>;

/** Phong bì danh sách: `{ data: [...], nextCursor }`; `nextCursor = null` khi hết dữ liệu. */
export function cursorPageSchema<T extends z.ZodType>(item: T) {
  return z.object({
    data: z.array(item),
    nextCursor: z.string().nullable(),
  });
}
export type CursorPage<T> = { data: T[]; nextCursor: string | null };

export const SORT_DIRECTIONS = ['asc', 'desc'] as const;
export type SortDirection = (typeof SORT_DIRECTIONS)[number];
export interface SortTerm<F extends string = string> {
  field: F;
  direction: SortDirection;
}

/**
 * Tham số sắp xếp `?sort=-publishedAt,priceVnd` (tiền tố `-` = giảm dần). Chỉ nhận field trong
 * danh sách cho phép (chống sort theo cột tùy ý). Kết quả: `[{ field, direction }]`.
 */
export function sortQuerySchema<const F extends readonly [string, ...string[]]>(fields: F) {
  const allowed = new Set<string>(fields);
  return z
    .string()
    .max(200)
    .transform((raw, ctx): SortTerm<F[number]>[] => {
      const terms: SortTerm<F[number]>[] = [];
      for (const part of raw.split(',')) {
        const token = part.trim();
        if (token === '') continue;
        const direction: SortDirection = token.startsWith('-') ? 'desc' : 'asc';
        const field = token.replace(/^[-+]/, '');
        if (!allowed.has(field)) {
          ctx.issues.push({
            code: 'custom',
            input: raw,
            message: `Không hỗ trợ sắp xếp theo "${field}". Dùng: ${fields.join(', ')}`,
          });
          return z.NEVER;
        }
        terms.push({ field: field as F[number], direction });
      }
      return terms;
    });
}

/** Bộ lọc nhiều giá trị dạng CSV: `?status=SENT,BIDDING` -> `['SENT','BIDDING']`. */
export function csvOf<T extends z.ZodType>(item: T) {
  return z.preprocess(
    (raw) =>
      typeof raw === 'string'
        ? raw
            .split(',')
            .map((part) => part.trim())
            .filter((part) => part !== '')
        : raw,
    z.array(item).max(50),
  );
}

/**
 * Query danh sách chuẩn: phân trang con trỏ + tìm kiếm `q` + `sort`. Bộ lọc riêng của từng
 * tài nguyên là query phẳng, thêm bằng `.extend({...})`.
 */
export function listQuerySchema<const F extends readonly [string, ...string[]]>(sortFields: F) {
  return CursorPageQuerySchema.extend({
    q: z.string().trim().min(1).max(100).optional(),
    sort: sortQuerySchema(sortFields).optional(),
  });
}
