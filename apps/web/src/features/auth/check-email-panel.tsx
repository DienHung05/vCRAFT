'use client';

import { Button } from '@vcraft/ui';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { Link } from '@/i18n/navigation';
import { browserSupabase } from '@/lib/auth/supabase-browser';
import { type AuthErrorKey, authErrorKey } from './auth-errors';
import { FormAlert } from './fields';

const RESEND_COOLDOWN_SECONDS = 60;

/**
 * Màn "kiểm tra hộp thư" sau khi đăng ký (FR-AUTH-01): chưa xác minh email thì chưa đăng nhập được.
 * Gửi lại thư có thời gian chờ để không đập vào giới hạn tần suất của Supabase.
 */
export function CheckEmailPanel({
  email,
  signInNext,
}: {
  email: string;
  /** Đích quay lại sau đăng nhập (vd. wizard đăng ký hộ). */
  signInNext?: string;
}) {
  const t = useTranslations('auth.checkEmail');
  const errors = useTranslations('auth.errors');
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_SECONDS);
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [error, setError] = useState<AuthErrorKey | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);

  // The panel replaces the form: move focus to its heading so it is announced.
  useEffect(() => {
    heading.current?.focus();
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  const resend = async () => {
    const supabase = browserSupabase();
    if (!supabase) return setError('unconfigured');
    setState('sending');
    setError(null);
    try {
      const { error: failure } = await supabase.auth.resend({ type: 'signup', email });
      if (failure) {
        setState('idle');
        return setError(authErrorKey(failure));
      }
      setState('sent');
      setCooldown(RESEND_COOLDOWN_SECONDS);
    } catch (failure) {
      setState('idle');
      setError(authErrorKey(failure));
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <h2 ref={heading} tabIndex={-1} className="font-display text-h3 text-glaze outline-none">
        {t('title')}
      </h2>
      <p>{t('lead', { email })}</p>
      <p className="text-small text-ash">{t('spam')}</p>
      {/* Supabase answers sign-up for an address that already has an account with the same
          success and sends no mail, so this hint is shown to everyone (no enumeration). */}
      <p className="text-small text-ash">
        {t.rich('existingAccount', {
          signIn: (chunks) => (
            <Link href="/dang-nhap" className="text-clay underline underline-offset-4">
              {chunks}
            </Link>
          ),
          forgot: (chunks) => (
            <Link href="/quen-mat-khau" className="text-clay underline underline-offset-4">
              {chunks}
            </Link>
          ),
        })}
      </p>
      {error ? <FormAlert tone="error">{errors(error)}</FormAlert> : null}
      {state === 'sent' && !error ? <FormAlert tone="success">{t('resent')}</FormAlert> : null}
      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant="secondary"
          onClick={resend}
          disabled={cooldown > 0 || state === 'sending'}
        >
          {state === 'sending'
            ? t('resending')
            : cooldown > 0
              ? t('cooldown', { seconds: cooldown })
              : t('resend')}
        </Button>
      </div>
      <p className="text-small text-ash">
        {t('verified')}{' '}
        <Link
          href={{ pathname: '/dang-nhap', ...(signInNext ? { query: { next: signInNext } } : {}) }}
          className="text-clay underline underline-offset-4"
        >
          {t('signInLink')}
        </Link>
      </p>
    </div>
  );
}
