import { verifyAuth } from '@supabase/server/core';

/** Danh tính đã kiểm chứng từ access token (Supabase = ai, vCraft = được làm gì; ARCHITECTURE §7.5). */
export interface VerifiedIdentity {
  readonly sub: string;
  readonly email: string;
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
    return { sub: data.userClaims.id, email: data.userClaims.email ?? '' };
  }
}
