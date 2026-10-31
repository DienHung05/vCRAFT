const LOCALE_PREFIXED = /^\/(vi|en)(?:[/?#]|$)/;
const MAX_LENGTH = 512;

/**
 * Chỉ nhận đường dẫn nội bộ có tiền tố ngôn ngữ (vd. `/vi/yeu-cau-bao-gia/x?tab=1`) làm đích quay lại
 * sau đăng nhập. Mọi dạng có thể dẫn ra ngoài (`//evil.test`, `https://…`, `\`, ký tự điều khiển)
 * bị loại, chống open redirect.
 */
export function safeReturnTo(raw: string | null | undefined): string | null {
  if (!raw || raw.length > MAX_LENGTH) return null;
  if (!raw.startsWith('/') || raw.startsWith('//') || raw.includes('\\')) return null;
  // biome-ignore lint/suspicious/noControlCharactersInRegex: chủ đích loại ký tự điều khiển
  if (/[\u0000-\u001f\u007f]/.test(raw)) return null;
  if (!LOCALE_PREFIXED.test(raw)) return null;
  try {
    if (new URL(raw, 'http://vcraft.invalid').origin !== 'http://vcraft.invalid') return null;
  } catch {
    return null;
  }
  return raw;
}

/** Ngôn ngữ của một đường dẫn đã có tiền tố (`/en/quotes` → `en`), hoặc `null`. */
export function localeOfPath(path: string | null | undefined): 'vi' | 'en' | null {
  const match = path ? LOCALE_PREFIXED.exec(path) : null;
  return match?.[1] === 'vi' || match?.[1] === 'en' ? match[1] : null;
}

/** Giá trị đầu tiên của một tham số query (Next trả `string | string[] | undefined`). */
export function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
