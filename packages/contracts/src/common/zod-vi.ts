import { z } from 'zod';

type Issue = z.core.$ZodRawIssue;

const num = (value: unknown): string => String(value);

const STRING_FORMATS: Record<string, string> = {
  email: 'Email không hợp lệ',
  uuid: 'Mã định danh không hợp lệ',
  guid: 'Mã định danh không hợp lệ',
  url: 'Đường dẫn không hợp lệ',
  datetime: 'Thời điểm không hợp lệ (cần dạng ISO 8601)',
  date: 'Ngày không hợp lệ (cần dạng YYYY-MM-DD)',
  time: 'Giờ không hợp lệ',
  regex: 'Định dạng không hợp lệ',
};

function tooSmall(issue: Extract<Issue, { code: 'too_small' }>): string {
  const min = num(issue.minimum);
  switch (issue.origin) {
    case 'string':
      return min === '1' && issue.inclusive !== false
        ? 'Không được để trống'
        : `Cần tối thiểu ${min} ký tự`;
    case 'array':
    case 'set':
      return `Cần ít nhất ${min} mục`;
    case 'date':
      return 'Thời điểm quá sớm';
    default:
      return issue.inclusive === false
        ? `Giá trị phải lớn hơn ${min}`
        : `Giá trị phải từ ${min} trở lên`;
  }
}

function tooBig(issue: Extract<Issue, { code: 'too_big' }>): string {
  const max = num(issue.maximum);
  switch (issue.origin) {
    case 'string':
      return `Tối đa ${max} ký tự`;
    case 'array':
    case 'set':
      return `Tối đa ${max} mục`;
    case 'date':
      return 'Thời điểm quá muộn';
    default:
      return issue.inclusive === false ? `Giá trị phải nhỏ hơn ${max}` : `Giá trị tối đa là ${max}`;
  }
}

/**
 * Bản đồ lỗi Zod tiếng Việt (NFR-UX-05: thông điệp cụ thể, chỉ cách sửa). Message tự đặt trong
 * schema luôn được ưu tiên hơn bản đồ này (quy tắc ưu tiên của Zod 4).
 */
export function vietnameseZodError(issue: Issue): string | undefined {
  switch (issue.code) {
    case 'invalid_type':
      return issue.input === undefined || issue.input === null
        ? 'Trường này là bắt buộc'
        : 'Giá trị không đúng kiểu dữ liệu';
    case 'too_small':
      return tooSmall(issue);
    case 'too_big':
      return tooBig(issue);
    case 'invalid_format':
      return STRING_FORMATS[issue.format] ?? 'Định dạng không hợp lệ';
    case 'invalid_value':
      return 'Giá trị không nằm trong danh sách cho phép';
    case 'not_multiple_of':
      return `Giá trị phải là bội của ${num(issue.divisor)}`;
    case 'unrecognized_keys':
      return 'Trường không được hỗ trợ';
    case 'invalid_union':
      return 'Giá trị không hợp lệ';
    case 'custom':
      return 'Giá trị không hợp lệ';
    default:
      return undefined;
  }
}

/**
 * Bật thông điệp tiếng Việt cho mọi `safeParse` của tiến trình (gọi một lần lúc khởi động
 * API/worker; FE dùng i18n riêng). Không tự chạy khi import để package không có side effect.
 */
export function applyVietnameseZodErrors(): void {
  z.config({ customError: vietnameseZodError });
}
