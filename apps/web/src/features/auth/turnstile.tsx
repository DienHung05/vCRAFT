'use client';

import { Turnstile, type TurnstileInstance } from '@marsidev/react-turnstile';
import { useLocale } from 'next-intl';
import { type ReactNode, useCallback, useRef, useState } from 'react';

/**
 * Cloudflare Turnstile site key (FR-AUTH-07). Empty turns the CAPTCHA off, as in local development, unit
 * tests and the CI build; Cloudflare's test key `1x00000000000000000000AA` always passes.
 */
export function turnstileSiteKey(): string {
  return process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() ?? '';
}

export interface Captcha {
  /** The widget to place above the submit button, or `null` when Turnstile is off. */
  widget: ReactNode;
  /** True while Turnstile is on and has not produced a token yet. */
  missing: boolean;
  /** Spread into the Supabase call's `options`: `{ captchaToken }`, or nothing when Turnstile is off. */
  options: { captchaToken?: string };
  /** A token is single-use: call after every attempt so the next one gets a fresh token. */
  reset: () => void;
}

/**
 * Turnstile for a Supabase Auth form. Supabase checks the token server-side when CAPTCHA protection is on
 * in the project (`[auth.captcha]`), so the browser only passes it along.
 */
export function useCaptcha(): Captcha {
  const locale = useLocale();
  const ref = useRef<TurnstileInstance>(undefined);
  const [token, setToken] = useState<string | null>(null);
  const siteKey = turnstileSiteKey();
  const reset = useCallback(() => {
    setToken(null);
    ref.current?.reset();
  }, []);

  if (!siteKey) return { widget: null, missing: false, options: {}, reset };
  return {
    widget: (
      <Turnstile
        ref={ref}
        siteKey={siteKey}
        options={{ language: locale, theme: 'auto', size: 'flexible' }}
        onSuccess={setToken}
        onExpire={() => setToken(null)}
        onError={() => setToken(null)}
        className="min-h-[65px]"
      />
    ),
    missing: token === null,
    options: token ? { captchaToken: token } : {},
    reset,
  };
}
