/**
 * Slug ASCII từ chuỗi tiếng Việt: bỏ dấu, `đ` → `d`, chữ thường, nối bằng `-`
 * (khớp `SLUG_PATTERN` của `@vcraft/contracts`). Chuỗi không còn ký tự hợp lệ trả `''`.
 */
/** Chuỗi tìm kiếm đã bỏ dấu, chữ thường: `Bát Tràng` thành `bat trang` (FR-CAT-04). */
export function normalizeSearchText(input: string, maxLength = 600): string {
  return slugify(input, maxLength).replaceAll('-', ' ');
}

/** Tách câu tìm kiếm thành các từ đã bỏ dấu; chỉ còn `[a-z0-9]` nên an toàn khi đưa vào `LIKE`. */
export function searchTerms(query: string): string[] {
  return normalizeSearchText(query, 120).split(' ').filter(Boolean);
}

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
