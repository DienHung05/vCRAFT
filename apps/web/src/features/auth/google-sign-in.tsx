'use client';

import { Button } from '@vcraft/ui';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { setRememberPreference } from '@/lib/auth/remember';
import { browserSupabase } from '@/lib/auth/supabase-browser';
import { FormAlert } from './fields';

/**
 * Where Google sends the visitor back: `/auth/callback` exchanges the PKCE code for a session. `next` is
 * an already-filtered return path; `consent` records the privacy policy on a first Google account.
 */
export function googleCallbackUrl(origin: string, locale: string, next: string | null): string {
  const query = new URLSearchParams({ locale, consent: '1' });
  if (next) query.set('next', next);
  return `${origin}/auth/callback?${query}`;
}

/**
 * "Continue with Google" (GH#122): Supabase OAuth with PKCE, the code verifier kept in a cookie by
 * `@supabase/ssr`, so the server callback can finish the sign-in. The first Google sign-in creates a
 * BUYER account like an email sign-up; the provider never sets a role. Continuing means agreeing to the
 * privacy policy, which the notice under the button says, and `disabled` holds the button on the
 * register page until its consent box is ticked.
 */
export function GoogleSignIn({
  next,
  disabled = false,
  remember = true,
}: {
  next: string | null;
  disabled?: boolean;
  /** Keep the session after the browser closes (default). `false` makes the auth cookies session-only. */
  remember?: boolean;
}) {
  const t = useTranslations('auth.google');
  const locale = useLocale();
  const [state, setState] = useState<'idle' | 'redirecting' | 'failed'>('idle');

  const start = async () => {
    const supabase = browserSupabase();
    if (!supabase) return setState('failed');
    setState('redirecting');
    // Before the PKCE verifier cookie is written, so the callback session follows the choice too.
    setRememberPreference(remember);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: googleCallbackUrl(window.location.origin, locale, next) },
    });
    // On success the browser is already on its way to Google.
    if (error) setState('failed');
  };

  return (
    <div className="flex flex-col gap-2">
      {state === 'failed' ? <FormAlert tone="error">{t('failed')}</FormAlert> : null}
      <Button
        type="button"
        variant="secondary"
        size="lg"
        disabled={disabled || state === 'redirecting'}
        onClick={() => void start()}
        className="gap-3"
      >
        <GoogleMark />
        {state === 'redirecting' ? t('redirecting') : t('continue')}
      </Button>
      <p className="text-small text-ash">{t('notice')}</p>
    </div>
  );
}

/** Google's "G" in its brand colours, as its sign-in branding guidelines ask. */
function GoogleMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 18 18" className="size-[18px]">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z"
      />
      <path
        fill="#FBBC05"
        d="M3.97 10.72A5.41 5.41 0 0 1 3.68 9c0-.6.1-1.18.29-1.72V4.95H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.05l3.01-2.33z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z"
      />
    </svg>
  );
}
