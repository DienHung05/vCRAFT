import { AccountApiError } from '@vcraft/api-client';
import { messages } from '@vcraft/i18n';
import { describe, expect, it } from 'vitest';
import { type AuthErrorKey, authErrorKey } from '@/features/auth/auth-errors';
import { VALIDATION_KEYS } from '@/features/auth/schemas';

const supabaseError = (code: string, status = 400) =>
  Object.assign(new Error(code), { code, status });

describe('authErrorKey (thông điệp lỗi cụ thể, NFR-UX-05)', () => {
  it('đăng nhập sai báo chung email hoặc mật khẩu, không tiết lộ email có tồn tại', () => {
    expect(authErrorKey(supabaseError('invalid_credentials'))).toBe('invalid_credentials');
    expect(messages.vi.auth.errors.invalid_credentials).toContain(
      'Tên đăng nhập, email hoặc mật khẩu',
    );
  });

  it('email chưa xác minh được tách riêng để gợi ý gửi lại thư', () => {
    expect(authErrorKey(supabaseError('email_not_confirmed'))).toBe('email_not_confirmed');
  });

  it.each([
    ['weak_password', 'weak_password'],
    ['same_password', 'same_password'],
    ['user_banned', 'user_banned'],
    ['otp_expired', 'link_invalid'],
    ['over_email_send_rate_limit', 'rate_limited'],
    ['over_request_rate_limit', 'rate_limited'],
    ['email_address_invalid', 'email_invalid'],
    ['session_not_found', 'sessionExpired'],
  ])('mã Supabase %s → %s', (code, key) => {
    expect(authErrorKey(supabaseError(code))).toBe(key);
  });

  it('HTTP 429 không kèm mã vẫn là giới hạn tần suất', () => {
    expect(authErrorKey({ status: 429 })).toBe('rate_limited');
  });

  it('mất mạng (fetch ném TypeError hoặc AuthRetryableFetchError) → network', () => {
    expect(authErrorKey(new TypeError('Failed to fetch'))).toBe('network');
    expect(authErrorKey({ name: 'AuthRetryableFetchError', status: 0 })).toBe('network');
  });

  it('lỗi API vCraft theo mã ổn định', () => {
    expect(authErrorKey(new AccountApiError('CONFLICT_DUPLICATE', 409))).toBe('slugTaken');
    expect(authErrorKey(new AccountApiError('AUTH_TOKEN_EXPIRED', 401))).toBe('sessionExpired');
    expect(authErrorKey(new AccountApiError('MEDIA_TOO_LARGE', 413))).toBe('mediaTooLarge');
    expect(authErrorKey(new AccountApiError('MEDIA_UNSUPPORTED_TYPE', 415))).toBe(
      'mediaUnsupported',
    );
    expect(authErrorKey(new AccountApiError('HOUSEHOLD_ACCOUNT_LOCKED', 403))).toBe('locked');
    expect(authErrorKey(new AccountApiError('INTERNAL_ERROR', 503))).toBe('apiDown');
    expect(authErrorKey(new AccountApiError('NOT_FOUND', 404))).toBe('unknown');
  });

  it('lỗi lạ không bao giờ lộ nguyên văn tiếng Anh', () => {
    expect(authErrorKey(new Error('Some English internal message'))).toBe('unknown');
    expect(authErrorKey('boom')).toBe('unknown');
  });
});

describe('từ điển cho form tài khoản', () => {
  const keys: AuthErrorKey[] = [
    'invalid_credentials',
    'email_not_confirmed',
    'email_exists',
    'rate_limited',
    'weak_password',
    'same_password',
    'user_banned',
    'link_invalid',
    'signup_disabled',
    'email_invalid',
    'network',
    'unknown',
    'unconfigured',
    'sessionExpired',
    'slugTaken',
    'locked',
    'forbidden',
    'mediaTooLarge',
    'mediaUnsupported',
    'apiDown',
  ];

  it.each(['vi', 'en'] as const)('mọi khóa lỗi có thông điệp (%s)', (locale) => {
    const table = messages[locale].auth.errors as Record<string, string>;
    for (const key of keys) expect(table[key], key).toBeTruthy();
  });

  it.each(['vi', 'en'] as const)('mọi khóa kiểm tra form có thông điệp (%s)', (locale) => {
    const table = messages[locale].auth.validation as Record<string, string>;
    for (const key of VALIDATION_KEYS) expect(table[key], key).toBeTruthy();
    expect(Object.keys(table).sort()).toEqual([...VALIDATION_KEYS].sort());
  });
});
