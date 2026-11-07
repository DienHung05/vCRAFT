import { AccountApiError } from '@vcraft/api-client';

/** Khóa trong `auth.errors` của từ điển: thông điệp tiếng Việt cụ thể, chỉ cách sửa (NFR-UX-05). */
export type AuthErrorKey =
  | 'usernameTaken'
  | 'usernameReserved'
  | 'invalid_credentials'
  | 'email_not_confirmed'
  | 'email_exists'
  | 'rate_limited'
  | 'weak_password'
  | 'same_password'
  | 'user_banned'
  | 'link_invalid'
  | 'signup_disabled'
  | 'email_invalid'
  | 'network'
  | 'unknown'
  | 'unconfigured'
  | 'sessionExpired'
  | 'slugTaken'
  | 'locked'
  | 'consentRequired'
  | 'forbidden'
  | 'mediaTooLarge'
  | 'mediaUnsupported'
  | 'apiDown'
  | 'captcha';

const SUPABASE_CODES: Readonly<Record<string, AuthErrorKey>> = {
  invalid_credentials: 'invalid_credentials',
  email_not_confirmed: 'email_not_confirmed',
  user_already_exists: 'email_exists',
  email_exists: 'email_exists',
  over_request_rate_limit: 'rate_limited',
  over_email_send_rate_limit: 'rate_limited',
  over_sms_send_rate_limit: 'rate_limited',
  weak_password: 'weak_password',
  same_password: 'same_password',
  user_banned: 'user_banned',
  otp_expired: 'link_invalid',
  otp_disabled: 'link_invalid',
  flow_state_expired: 'link_invalid',
  flow_state_not_found: 'link_invalid',
  signup_disabled: 'signup_disabled',
  email_address_invalid: 'email_invalid',
  session_expired: 'sessionExpired',
  session_not_found: 'sessionExpired',
  refresh_token_not_found: 'sessionExpired',
  refresh_token_already_used: 'sessionExpired',
  captcha_failed: 'captcha',
};

const API_CODES: Readonly<Record<string, AuthErrorKey>> = {
  AUTH_INVALID_CREDENTIALS: 'invalid_credentials',
  USERNAME_TAKEN: 'usernameTaken',
  USERNAME_RESERVED: 'usernameReserved',
  CAPTCHA_FAILED: 'captcha',
  AUTH_UNAUTHENTICATED: 'sessionExpired',
  AUTH_TOKEN_INVALID: 'sessionExpired',
  AUTH_TOKEN_EXPIRED: 'sessionExpired',
  AUTH_FORBIDDEN: 'forbidden',
  AUTH_ACCOUNT_SUSPENDED: 'locked',
  HOUSEHOLD_ACCOUNT_LOCKED: 'locked',
  CONSENT_REQUIRED: 'consentRequired',
  CONFLICT_DUPLICATE: 'slugTaken',
  MEDIA_TOO_LARGE: 'mediaTooLarge',
  MEDIA_UNSUPPORTED_TYPE: 'mediaUnsupported',
  RATE_LIMITED: 'rate_limited',
};

/**
 * Đổi lỗi của Supabase Auth, của API vCraft hoặc của `fetch` thành khóa thông điệp. Lỗi lạ không
 * bao giờ lộ nguyên văn tiếng Anh ra giao diện. Đăng nhập sai luôn báo chung "email hoặc mật khẩu"
 * để không tiết lộ email nào đã có tài khoản (FR-AUTH-07).
 */
export function authErrorKey(error: unknown): AuthErrorKey {
  if (error instanceof AccountApiError) {
    const mapped = API_CODES[error.code];
    if (mapped) return mapped;
    return error.status >= 500 ? 'apiDown' : 'unknown';
  }
  if (error instanceof TypeError) return 'network';
  if (typeof error === 'object' && error !== null) {
    const { code, status, name } = error as { code?: unknown; status?: unknown; name?: unknown };
    const mapped = typeof code === 'string' ? (API_CODES[code] ?? SUPABASE_CODES[code]) : undefined;
    if (mapped) return mapped;
    if (name === 'AuthRetryableFetchError' || status === 0) return 'network';
    if (status === 429) return 'rate_limited';
  }
  return 'unknown';
}
