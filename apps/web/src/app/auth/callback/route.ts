import { PRIVACY_POLICY_VERSION } from '@vcraft/domain';
import { defaultLocale } from '@vcraft/i18n';
import type { NextRequest } from 'next/server';
import { getPathname } from '@/i18n/navigation';
import { localeOfPath, safeReturnTo } from '@/lib/auth/return-to';
import { parseLocale, redirectTo } from '@/lib/auth/route-handler';
import { createServerSupabase } from '@/lib/auth/supabase-server';

/**
 * Return leg of "Continue with Google" (GH#122): exchanges the OAuth code for a session (PKCE, the
 * verifier is in the cookie `@supabase/ssr` set before leaving), then goes to `next` (filtered against
 * open redirects) or `/auth/continue` for the role's landing page. Cancelled consent at Google, a
 * disabled provider or a stale code lands on the sign-in page with a message.
 *
 * `consent=1` means the visitor agreed to the privacy policy on our page before leaving. It is written
 * into the user metadata, where the API reads it to record the SIGN_UP consent when it first creates
 * the account, exactly like the email sign-up form does.
 */
export async function GET(request: NextRequest): Promise<Response> {
  const { searchParams } = request.nextUrl;
  const next = safeReturnTo(searchParams.get('next'));
  const locale = localeOfPath(next) ?? parseLocale(searchParams.get('locale')) ?? defaultLocale;
  const failed = () =>
    redirectTo(`${getPathname({ href: '/dang-nhap', locale })}?error=oauth_failed`);

  const code = searchParams.get('code');
  const supabase = await createServerSupabase();
  if (!supabase || !code || searchParams.get('error')) return failed();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user) return failed();

  if (searchParams.get('consent') === '1' && !data.user.user_metadata?.privacy_policy_version) {
    // A failure here only means the consent is asked again later; the sign-in itself succeeded.
    await supabase.auth.updateUser({ data: { privacy_policy_version: PRIVACY_POLICY_VERSION } });
  }
  return redirectTo(
    `/auth/continue?locale=${locale}${next ? `&next=${encodeURIComponent(next)}` : ''}`,
  );
}
