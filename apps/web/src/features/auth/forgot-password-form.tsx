'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@vcraft/ui';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from '@/i18n/navigation';
import { browserSupabase } from '@/lib/auth/supabase-browser';
import { type AuthErrorKey, authErrorKey } from './auth-errors';
import { FormAlert, TextField } from './fields';
import { type ForgotPasswordValues, forgotPasswordSchema } from './schemas';
import { useValidationMessage } from './use-validation-message';

/**
 * Quên mật khẩu (FR-AUTH-06). Thông báo thành công luôn như nhau dù email có tài khoản hay không
 * (FR-AUTH-07); liên kết trong thư đưa tới `/dat-lai-mat-khau` (mẫu thư ở `supabase/templates`).
 */
export function ForgotPasswordForm() {
  const t = useTranslations('auth');
  const message = useValidationMessage();
  const [error, setError] = useState<AuthErrorKey | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordValues>({
    resolver: zodResolver(forgotPasswordSchema),
    mode: 'onTouched',
    defaultValues: { email: '' },
  });

  const onSubmit = handleSubmit(async ({ email }) => {
    setError(null);
    const supabase = browserSupabase();
    if (!supabase) return setError('unconfigured');
    try {
      const { error: failure } = await supabase.auth.resetPasswordForEmail(email);
      if (failure) return setError(authErrorKey(failure));
      setSentTo(email);
    } catch (failure) {
      setError(authErrorKey(failure));
    }
  });

  if (sentTo) {
    return (
      <div className="flex flex-col gap-4" aria-live="polite">
        <h2 className="font-display text-h3 text-glaze">{t('forgot.sentTitle')}</h2>
        <p>{t('forgot.sent', { email: sentTo })}</p>
        <Link href="/dang-nhap" className="text-small text-clay underline underline-offset-4">
          {t('forgot.back')}
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
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
      <Button type="submit" size="lg" disabled={isSubmitting}>
        {isSubmitting ? t('forgot.submitting') : t('forgot.submit')}
      </Button>
      <Link href="/dang-nhap" className="text-small text-clay underline underline-offset-4">
        {t('forgot.back')}
      </Link>
    </form>
  );
}
