import { createContextClient, verifyAuth } from '@supabase/server/core';

/** Danh tính đã kiểm chứng từ access token (Supabase = ai, vCraft = được làm gì; ARCHITECTURE §7.5). */
export interface VerifiedIdentity {
  readonly sub: string;
  readonly email: string;
  readonly emailVerified?: boolean;
  /**
   * Privacy policy version the person ticked on the sign-up form, carried in the Supabase user metadata
   * (`privacy_policy_version`). Only used to record `SIGN_UP` consent when the account is first created.
   */
  readonly consentPolicyVersion?: string;
  /** Authenticator assurance level of the session (`aal` claim): `aal2` after a second factor (GH#83). */
  readonly aal?: 'aal1' | 'aal2';
  /** Supabase session id (`session_id` claim), one per sign-in; used to record sign-in history. */
  readonly sessionId?: string;
  /** How the session started (first non-TOTP `amr` method): `password`, `oauth`, `otp`... */
  readonly method?: string;
}

/** Reads the assurance level, session and sign-in method from raw Supabase JWT claims. */
export function sessionFacts(claims: Readonly<Record<string, unknown>> | null | undefined): {
  aal?: 'aal1' | 'aal2';
  sessionId?: string;
  method?: string;
} {
  if (!claims) return {};
  const aal = claims.aal === 'aal2' ? 'aal2' : claims.aal === 'aal1' ? 'aal1' : undefined;
  const sessionId = typeof claims.session_id === 'string' ? claims.session_id : undefined;
  const amr = Array.isArray(claims.amr) ? (claims.amr as { method?: unknown }[]) : [];
  const method = amr
    .map((entry) => entry?.method)
    .find((m): m is string => typeof m === 'string' && m !== 'totp');
  return {
    ...(aal && { aal }),
    ...(sessionId && { sessionId: sessionId.slice(0, 64) }),
    ...(method && { method: method.slice(0, 20) }),
  };
}

/**
 * Cổng kiểm chứng danh tính. Production dùng {@link SupabaseIdentityVerifier}; test thay bằng bản giả
 * (`overrideProvider(IdentityVerifier)`) để không cần project Supabase thật.
 * Trả `null` khi request không mang thông tin xác thực; ném khi token sai/hết hạn.
 */
export abstract class IdentityVerifier {
  abstract verify(
    headers: Readonly<Record<string, string | string[] | undefined>>,
  ): Promise<VerifiedIdentity | null>;
}

export class InvalidTokenError extends Error {}

/** Bọc `verifyAuth()` của `@supabase/server` (kiểm chữ ký qua JWKS, `iss`, `aud`, `exp`). */
export class SupabaseIdentityVerifier extends IdentityVerifier {
  async verify(
    headers: Readonly<Record<string, string | string[] | undefined>>,
  ): Promise<VerifiedIdentity | null> {
    const authorization = headers.authorization;
    if (typeof authorization !== 'string' || authorization.trim() === '') return null;
    const request = new Request('http://api.internal/', { headers: { authorization } });
    const { data, error } = await verifyAuth(request, { auth: 'user' });
    if (error || !data.userClaims) throw new InvalidTokenError(error?.message ?? 'invalid token');
    // email_confirmed_at is maintained by Auth. User-editable metadata is not proof of verification.
    const supabase = createContextClient({ auth: { token: data.token } });
    const userResult = await supabase.auth.getUser(data.token ?? undefined);
    if (userResult.error || !userResult.data.user)
      throw new InvalidTokenError('could not verify user');
    const claimed: unknown = userResult.data.user.user_metadata?.privacy_policy_version;
    return {
      sub: data.userClaims.id,
      email: userResult.data.user.email ?? '',
      emailVerified: Boolean(userResult.data.user.email_confirmed_at),
      ...(typeof claimed === 'string' && { consentPolicyVersion: claimed }),
      ...sessionFacts(data.jwtClaims as Record<string, unknown> | null),
    };
  }
}
