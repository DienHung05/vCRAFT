'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@vcraft/ui';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from '@/i18n/navigation';
import { browserSupabase } from '@/lib/auth/supabase-browser';
import { type AuthErrorKey, authErrorKey } from './auth-errors';
import { FormAlert, STANDALONE_LINK, TextField } from './fields';
import { useKilnFeedback } from './kiln/kiln-feedback';
import { type ForgotPasswordValues, forgotPasswordSchema } from './schemas';
import { useCaptcha } from './turnstile';
import { useFocusSubmitOnError } from './use-focus-submit-on-error';
import { useValidationMessage } from './use-validation-message';

/**
 * Quên mật khẩu (FR-AUTH-06). Thông báo thành công luôn như nhau dù email có tài khoản hay không
 * (FR-AUTH-07); liên kết trong thư đưa tới `/dat-lai-mat-khau` (mẫu thư ở `supabase/templates`).
 */
export function ForgotPasswordForm() {
  const t = useTranslations('auth');
  const message = useValidationMessage();
  const kiln = useKilnFeedback();
  const [error, setError] = useState<AuthErrorKey | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const captcha = useCaptcha();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordValues>({
    resolver: zodResolver(forgotPasswordSchema),
    mode: 'onTouched',
    defaultValues: { email: '' },
  });

  // The kiln card reacts to the outcome: a failure crackles and shakes the card.
  const failWith = (key: AuthErrorKey) => {
    kiln.fail();
    setError(key);
  };

  const formRef = useFocusSubmitOnError(error, isSubmitting);

  const onSubmit = handleSubmit(
    async ({ email }) => {
      kiln.fire();
      setError(null);
      const supabase = browserSupabase();
      if (!supabase) return failWith('unconfigured');
      if (captcha.missing) return failWith('captcha');
      try {
        const { error: failure } = await supabase.auth.resetPasswordForEmail(
          email,
          captcha.options,
        );
        if (failure) throw failure;
      } catch (failure) {
        captcha.reset();
        const key = authErrorKey(failure);
        // Email quotas can reveal whether an account exists. Keep the generic recovery outcome.
        if (key !== 'rate_limited') return failWith(key);
      }
      kiln.reset();
      setSentTo(email);
    },
    () => kiln.fail('invalid'),
  );

  if (sentTo) {
    return <SentPanel email={sentTo} />;
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} noValidate className="flex flex-col gap-2.5 md:gap-3">
      {error ? <FormAlert tone="error">{t(`errors.${error}`)}</FormAlert> : null}
      <TextField
        label={t('fields.email')}
        type="email"
        autoComplete="email"
        inputMode="email"
        placeholder={t('fields.emailPlaceholder')}
        error={message(errors.email)}
        {...register('email')}
      />
      {captcha.widget}
      <Button type="submit" size="lg" disabled={isSubmitting}>
        {isSubmitting ? t('forgot.submitting') : t('forgot.submit')}
      </Button>
      <Link href="/dang-nhap" className={`${STANDALONE_LINK} text-small`}>
        {t('forgot.back')}
      </Link>
    </form>
  );
}

/**
 * The "check your inbox" panel that replaces the form. Focus moves to its heading (and is announced there), so
 * the panel is not a live region mounted already filled in, which most screen readers would not announce.
 */
function SentPanel({ email }: { email: string }) {
  const t = useTranslations('auth');
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus();
  }, []);
  return (
    <div className="flex flex-col gap-4">
      <h2 ref={heading} tabIndex={-1} className="font-display text-h3 text-glaze outline-none">
        {t('forgot.sentTitle')}
      </h2>
      <p>{t('forgot.sent', { email })}</p>
      <Link href="/dang-nhap" className={`${STANDALONE_LINK} text-small`}>
        {t('forgot.back')}
      </Link>
    </div>
  );
}
