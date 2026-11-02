'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@vcraft/ui';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from '@/i18n/navigation';
import { browserSupabase } from '@/lib/auth/supabase-browser';
import { type AuthErrorKey, authErrorKey } from './auth-errors';
import { FormAlert, PasswordField, STANDALONE_LINK, TextField } from './fields';
import { useKilnFeedback } from './kiln/kiln-feedback';
import { type SignInValues, signInSchema } from './schemas';
import { useFocusSubmitOnError } from './use-focus-submit-on-error';
import { useValidationMessage } from './use-validation-message';

export interface SignInFormProps {
  /** Đích quay lại đã lọc an toàn (`safeReturnTo`); không có thì vào trang theo vai trò. */
  next: string | null;
  /** Hiện dòng "cần đăng nhập để vào trang này" khi bị guard chuyển tới. */
  needSignIn?: boolean;
  /** Liên kết xác minh/đặt mật khẩu trước đó đã hỏng. */
  linkInvalid?: boolean;
}

/**
 * Đăng nhập email + mật khẩu qua Supabase Auth (FR-AUTH-04). Giữ nguyên mọi ô đã nhập khi lỗi
 * (NFR-UX-05). Thành công thì tải lại toàn trang để server render thấy cookie phiên mới.
 */
export function SignInForm({ next, needSignIn = false, linkInvalid = false }: SignInFormProps) {
  const t = useTranslations('auth');
  const locale = useLocale();
  const message = useValidationMessage();
  const kiln = useKilnFeedback();
  const [error, setError] = useState<AuthErrorKey | null>(null);
  const [resend, setResend] = useState<'idle' | 'sending' | 'sent'>('idle');
  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<SignInValues>({
    resolver: zodResolver(signInSchema),
    mode: 'onTouched',
    defaultValues: { email: '', password: '' },
  });

  // The kiln card reacts to the outcome: a failure crackles and shakes the card.
  const failWith = (key: AuthErrorKey) => {
    kiln.fail();
    setError(key);
  };

  const formRef = useFocusSubmitOnError(error, isSubmitting);

  const onSubmit = handleSubmit(
    async ({ email, password }) => {
      kiln.fire();
      setError(null);
      setResend('idle');
      const supabase = browserSupabase();
      if (!supabase) return failWith('unconfigured');
      try {
        const { error: failure } = await supabase.auth.signInWithPassword({ email, password });
        if (failure) return failWith(authErrorKey(failure));
        const destination = next ?? `/auth/continue?locale=${locale}`;
        // The seal stamps first (the destination is prerendered meanwhile), then the navigation
        // (a cross-document view transition) follows.
        await kiln.seal(destination);
        // Tải lại toàn trang để Server Component đọc cookie phiên mới.
        window.location.assign(destination);
      } catch (failure) {
        failWith(authErrorKey(failure));
      }
    },
    // Client validation failed: nothing was sent, but the card still reacts.
    () => kiln.fail('invalid'),
  );

  const resendVerification = async () => {
    const supabase = browserSupabase();
    if (!supabase) return;
    setResend('sending');
    const { error: failure } = await supabase.auth.resend({
      type: 'signup',
      email: getValues('email').trim(),
    });
    if (failure) {
      setResend('idle');
      return setError(authErrorKey(failure));
    }
    setResend('sent');
  };

  return (
    <form ref={formRef} onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      {linkInvalid ? <FormAlert tone="error">{t('signIn.notice.linkInvalid')}</FormAlert> : null}
      {needSignIn && !error ? <FormAlert tone="info">{t('signIn.needSignIn')}</FormAlert> : null}
      {error ? <FormAlert tone="error">{t(`errors.${error}`)}</FormAlert> : null}
      {error === 'email_not_confirmed' ? (
        <div className="flex flex-col items-start gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="min-h-11"
            onClick={resendVerification}
            disabled={resend === 'sending'}
          >
            {resend === 'sending' ? t('signIn.resending') : t('signIn.resend')}
          </Button>
          {resend === 'sent' ? (
            <FormAlert tone="success">
              {t('signIn.resent', { email: getValues('email').trim() })}
            </FormAlert>
          ) : null}
        </div>
      ) : null}

      <TextField
        label={t('fields.email')}
        type="email"
        autoComplete="email"
        inputMode="email"
        placeholder={t('fields.emailPlaceholder')}
        error={message(errors.email)}
        {...register('email')}
      />
      <PasswordField
        label={t('fields.password')}
        autoComplete="current-password"
        error={message(errors.password)}
        {...register('password')}
      />

      <Button type="submit" size="lg" disabled={isSubmitting}>
        {isSubmitting ? t('signIn.submitting') : t('signIn.submit')}
      </Button>

      <div className="flex flex-col text-small">
        <Link href="/quen-mat-khau" className={STANDALONE_LINK}>
          {t('signIn.forgot')}
        </Link>
        <p className="py-2.5 text-ash">
          {t('signIn.noAccount')}{' '}
          <Link href="/dang-ky" className="text-clay underline underline-offset-4">
            {t('signIn.registerLink')}
          </Link>
        </p>
        <Link href="/dang-ky-nghe-nhan" className={STANDALONE_LINK}>
          {t('signIn.householdLink')}
        </Link>
      </div>
    </form>
  );
}
