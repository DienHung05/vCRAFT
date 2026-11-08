import { type AccountRole, isValidUsername, normalizeUsername } from '@vcraft/domain';
import { z } from 'zod';
import { IdSchema, IsoDateTimeSchema } from '../common';
import { HouseholdReviewStateSchema, HouseholdStatusSchema } from '../households';

/** Canonical login name. Reserved names are checked by the application for public registration. */
export const UsernameSchema = z.string().transform(normalizeUsername).refine(isValidUsername);

/** Tài khoản và phiên (FR-AUTH-09): Supabase giữ danh tính, vai trò và trạng thái nằm ở CSDL vCraft. */

export const AccountRoleSchema = z.enum([
  'ADMIN',
  'HOUSEHOLD',
  'BUYER',
]) satisfies z.ZodType<AccountRole>;

export const AccountStatusSchema = z.enum(['ACTIVE', 'LOCKED']);
export type AccountStatusDto = z.infer<typeof AccountStatusSchema>;

/**
 * `GET /me`: người đang đăng nhập, để web quyết định khu vực nào được vào. Chỉ gồm điều giao diện
 * cần cho guard (vai trò, trạng thái, tình trạng hồ sơ hộ); dữ liệu hộ đầy đủ ở `GET /me/household`.
 */
export const MeResponseSchema = z.object({
  id: IdSchema,
  email: z.string(),
  username: UsernameSchema.nullable().default(null),
  fullName: z.string().nullable(),
  role: AccountRoleSchema,
  status: AccountStatusSchema,
  emailVerified: z.boolean(),
  /**
   * GH#83: an admin whose session has not passed the second factor yet (`aal1`). The web shows the TOTP
   * enrolment or code screen instead of the admin area; the API answers admin routes with `AUTH_MFA_REQUIRED`.
   * Defaults to false so a web build that ships before the API still reads an older `/me`.
   */
  mfaRequired: z.boolean().default(false),
  /** Có khi tài khoản đã nộp hồ sơ hộ; `statusReason` là lý do từ chối / tạm ngừng (chỉ chủ hồ sơ thấy). */
  household: z
    .object({
      id: IdSchema,
      name: z.string(),
      slug: z.string(),
      status: HouseholdStatusSchema,
      statusReason: z.string().nullable(),
      /** Derived review state (vCRAFT-8my.2): NEW, AWAITING_APPLICANT (a request is active) or RESUBMITTED. */
      reviewState: HouseholdReviewStateSchema.default('NEW'),
      resubmittedAt: IsoDateTimeSchema.nullable().default(null),
    })
    .nullable(),
});
export type MeDto = z.infer<typeof MeResponseSchema>;

/** `GET /me/login-events`: the account's recent sign-ins, newest first (GH#83). */
export const LoginEventSchema = z.object({
  id: IdSchema,
  /** How the session started: `password`, `oauth`, `otp`, `recovery`... (Supabase `amr`). */
  method: z.string(),
  /** `aal2` once the session passed the second factor. */
  aal: z.enum(['aal1', 'aal2']),
  /** Coarse browser and system label such as "Chrome · Windows"; null for sessions recorded before it existed. */
  browser: z.string().nullable().default(null),
  /** ISO 3166-1 alpha-2 country the hosting edge reported (rough location); null when unknown. */
  country: z.string().nullable().default(null),
  /** True for the session that made this request. */
  current: z.boolean().default(false),
  /** Set once the person signed this session out with "sign out other devices". */
  signedOutAt: IsoDateTimeSchema.nullable().default(null),
  createdAt: IsoDateTimeSchema,
});
export type LoginEventDto = z.infer<typeof LoginEventSchema>;
export const LoginEventListSchema = z.object({ items: z.array(LoginEventSchema) });
export type LoginEventListDto = z.infer<typeof LoginEventListSchema>;

export const ChooseUsernameRequestSchema = z.object({ username: UsernameSchema });
export const PasswordSignInRequestSchema = z.object({
  identifier: z.string().trim().min(1).max(320),
  password: z.string().min(1).max(1024),
  captchaToken: z.string().max(4096).optional(),
});
export const PasswordSignUpRequestSchema = z.object({
  username: UsernameSchema,
  email: z
    .email()
    .max(320)
    .transform((value) => value.toLowerCase()),
  password: z
    .string()
    .min(8)
    .max(1024)
    .refine((value) => /\p{L}/u.test(value) && /\d/.test(value)),
  captchaToken: z.string().max(4096).optional(),
  locale: z.enum(['vi', 'en']).default('vi'),
  privacyPolicyVersion: z.string().max(30),
  householdIntent: z.boolean().optional(),
  next: z.string().max(512).optional(),
});
export type PasswordSignInRequest = z.infer<typeof PasswordSignInRequestSchema>;
export type PasswordSignUpRequest = z.infer<typeof PasswordSignUpRequestSchema>;
