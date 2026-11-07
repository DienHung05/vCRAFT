import { createClient } from '@supabase/supabase-js';
import type { PasswordSignUpRequest } from '@vcraft/contracts';
import { AppError } from '../errors/app-error';

export type PasswordSession = { access_token: string; refresh_token: string };
export type PasswordCredentials = { email: string; password: string; captchaToken?: string };

/** The external identity boundary. Each attempt gets a client with no persisted or shared session. */
export abstract class PasswordIdentityProvider {
  abstract signIn(credentials: PasswordCredentials): Promise<PasswordSession | null>;
  abstract signUp(body: PasswordSignUpRequest): Promise<{ id: string; email: string } | null>;
}

export class SupabasePasswordIdentityProvider extends PasswordIdentityProvider {
  private client() {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_PUBLISHABLE_KEY;
    if (!url || !key) throw new AppError('SERVICE_UNAVAILABLE');
    return createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: {
        fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(10_000) }),
      },
    });
  }

  async signIn({
    email,
    password,
    captchaToken,
  }: PasswordCredentials): Promise<PasswordSession | null> {
    const { data, error } = await this.client().auth.signInWithPassword({
      email,
      password,
      options: { captchaToken },
    });
    if (error?.code === 'captcha_failed') throw new AppError('CAPTCHA_FAILED');
    if (error || !data.session) return null;
    return { access_token: data.session.access_token, refresh_token: data.session.refresh_token };
  }

  async signUp(body: PasswordSignUpRequest): Promise<{ id: string; email: string } | null> {
    const { data, error } = await this.client().auth.signUp({
      email: body.email,
      password: body.password,
      options: {
        captchaToken: body.captchaToken,
        data: {
          username: body.username,
          locale: body.locale,
          privacy_policy_version: body.privacyPolicyVersion,
          ...(body.householdIntent && { household_intent: true }),
          ...(body.next &&
            /^\/(vi|en)(\/|$)/.test(body.next) &&
            !body.next.includes('\\') && { next: body.next }),
        },
      },
    });
    if (error?.code === 'captcha_failed') throw new AppError('CAPTCHA_FAILED');
    if (error?.status === 429) throw new AppError('RATE_LIMITED');
    if (error) throw new AppError('VALIDATION_FAILED');
    // Supabase deliberately returns an obfuscated identity for an existing confirmed email.
    if (!data.user || data.user.identities?.length === 0) return null;
    return { id: data.user.id, email: data.user.email ?? body.email };
  }
}
