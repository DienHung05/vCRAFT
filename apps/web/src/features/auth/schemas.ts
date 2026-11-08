import { SLUG_PATTERN, UsernameSchema } from '@vcraft/contracts';
import { ID_NUMBER_PATTERN, isReservedUsername } from '@vcraft/domain';
import { z } from 'zod';

/**
 * Luật kiểm tra ở trình duyệt cho các form tài khoản. Thông điệp lỗi của Zod là KHÓA trong
 * `auth.validation` của từ điển (không phải câu chữ), nên cùng một schema phục vụ cả vi lẫn en;
 * `useValidationMessage` dịch khi hiển thị. Luật cuối cùng vẫn do API/Supabase ép.
 */
export const VALIDATION_KEYS = [
  'identifierRequired',
  'usernameRequired',
  'usernameInvalid',
  'usernameReserved',
  'emailRequired',
  'emailInvalid',
  'passwordRequired',
  'passwordShort',
  'passwordWeak',
  'confirmMismatch',
  'nameShort',
  'slugRequired',
  'slugInvalid',
  'workshopNameShort',
  'addressShort',
  'locationRequired',
  'latInvalid',
  'lngInvalid',
  'consentRequired',
  'idNumberInvalid',
] as const;
export type ValidationKey = (typeof VALIDATION_KEYS)[number];

export function isValidationKey(value: unknown): value is ValidationKey {
  return VALIDATION_KEYS.includes(value as ValidationKey);
}

const key = (k: ValidationKey) => k;

export const PASSWORD_MIN_LENGTH = 10;

const emailSchema = z
  .string()
  .trim()
  .min(1, key('emailRequired'))
  .pipe(z.email(key('emailInvalid')));

/** New passwords match Supabase's minimum length and lower_upper_letters_digits policy. */
const newPasswordSchema = z
  .string()
  .min(1, key('passwordRequired'))
  .min(PASSWORD_MIN_LENGTH, key('passwordShort'))
  .refine(
    (value) => /[a-z]/.test(value) && /[A-Z]/.test(value) && /[0-9]/.test(value),
    key('passwordWeak'),
  );

/** Đăng nhập chỉ cần có nhập: luật mật khẩu mới không được chặn người dùng mật khẩu cũ. */
export const signInSchema = z.object({
  identifier: z.string().trim().min(1, key('identifierRequired')).max(320, key('usernameInvalid')),
  password: z.string().min(1, key('passwordRequired')),
});
export type SignInValues = z.infer<typeof signInSchema>;

/** Consent to the privacy policy (NFR-SEC-07) is required to create an account; checked in the browser. */
const consentSchema = z.boolean().refine((value) => value === true, key('consentRequired'));

export const usernameSchema = z
  .string()
  .trim()
  .min(1, key('usernameRequired'))
  .refine((value) => UsernameSchema.safeParse(value).success, key('usernameInvalid'))
  .refine((value) => !isReservedUsername(value), key('usernameReserved'))
  .transform((value) => value.toLowerCase());

export const chooseUsernameSchema = z.object({ username: usernameSchema });

export const registerSchema = z.object({
  username: usernameSchema,
  email: emailSchema,
  password: newPasswordSchema,
  consent: consentSchema,
});
export type RegisterValues = z.infer<typeof registerSchema>;

export const forgotPasswordSchema = z.object({ email: emailSchema });
export type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>;

export const setPasswordSchema = z
  .object({ password: newPasswordSchema, confirm: z.string() })
  .refine((v) => v.password === v.confirm, { path: ['confirm'], message: key('confirmMismatch') });
export type SetPasswordValues = z.infer<typeof setPasswordSchema>;

/** Đổi mật khẩu khi đã đăng nhập (GH#37): xác nhận mật khẩu hiện tại rồi đặt mật khẩu mới khác nó. */
export const changePasswordSchema = z
  .object({
    current: z.string().min(1, key('passwordRequired')),
    password: newPasswordSchema,
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { path: ['confirm'], message: key('confirmMismatch') });
export type ChangePasswordValues = z.infer<typeof changePasswordSchema>;

export const householdStepSchema = z.object({
  name: z.string().trim().min(2, key('nameShort')).max(160, key('nameShort')),
  slug: z
    .string()
    .trim()
    .min(1, key('slugRequired'))
    .max(160, key('slugInvalid'))
    .regex(SLUG_PATTERN, key('slugInvalid')),
  village: z.string().trim().max(160),
  /** Citizen ID number (CCCD): the API stores it encrypted (NFR-SEC-03). */
  idNumber: z.string().trim().regex(ID_NUMBER_PATTERN, key('idNumberInvalid')),
  history: z.string().trim().max(10_000),
});
export type HouseholdStepValues = z.infer<typeof householdStepSchema>;

export const WORKSHOP_PURPOSES = ['PRODUCTION', 'SHOWROOM', 'BOTH'] as const;

export const workshopStepSchema = z.object({
  name: z.string().trim().min(2, key('workshopNameShort')).max(160, key('workshopNameShort')),
  address: z.string().trim().min(5, key('addressShort')).max(300, key('addressShort')),
  purpose: z.enum(WORKSHOP_PURPOSES),
  acceptsVisitors: z.boolean(),
  visitingInfo: z.string().trim().max(2_000),
  lat: z
    .number({ error: key('locationRequired') })
    .min(-90, key('latInvalid'))
    .max(90, key('latInvalid')),
  lng: z
    .number({ error: key('locationRequired') })
    .min(-180, key('lngInvalid'))
    .max(180, key('lngInvalid')),
});
export type WorkshopStepValues = z.infer<typeof workshopStepSchema>;
