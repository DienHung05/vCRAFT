import type { AccountRole } from '@vcraft/domain';
import { z } from 'zod';
import { IdSchema, IsoDateTimeSchema } from '../common';
import { HouseholdStatusSchema } from '../households';

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
  createdAt: IsoDateTimeSchema,
});
export type LoginEventDto = z.infer<typeof LoginEventSchema>;
export const LoginEventListSchema = z.object({ items: z.array(LoginEventSchema) });
export type LoginEventListDto = z.infer<typeof LoginEventListSchema>;
