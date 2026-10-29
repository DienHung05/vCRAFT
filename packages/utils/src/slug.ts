/**
 * Slug ASCII từ chuỗi tiếng Việt: bỏ dấu, `đ` → `d`, chữ thường, nối bằng `-`
 * (khớp `SLUG_PATTERN` của `@vcraft/contracts`). Chuỗi không còn ký tự hợp lệ trả `''`.
 */
export function slugify(input: string, maxLength = 120): string {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, maxLength)
    .replace(/-+$/g, '');
}
