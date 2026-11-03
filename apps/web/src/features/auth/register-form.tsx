'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { PRIVACY_POLICY_VERSION } from '@vcraft/domain';
import { Button } from '@vcraft/ui';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { ConsentCheckbox } from '@/components/consent-checkbox';
import { Link } from '@/i18n/navigation';
import { browserSupabase } from '@/lib/auth/supabase-browser';
import { type AuthErrorKey, authErrorKey } from './auth-errors';
import { CheckEmailPanel } from './check-email-panel';
import { FormAlert, PasswordField, STANDALONE_LINK, TextField } from './fields';
import { GoogleSignIn } from './google-sign-in';
import { useKilnFeedback } from './kiln/kiln-feedback';
import { type RegisterValues, registerSchema } from './schemas';
import { useFocusSubmitOnError } from './use-focus-submit-on-error';
import { useValidationMessage } from './use-validation-message';

export interface RegisterFormProps {
  /**
   * `household`: bước 1 của wizard đăng ký hộ. Đích sau khi xác minh email (`wizardPath`) được gửi
   * kèm trong metadata để thư xác minh đưa người dùng về đúng wizard thay vì trang chủ.
   */
  intent?: 'buyer' | 'household';
  wizardPath?: string;
}

/**
 * Đăng ký tài khoản bằng email + mật khẩu (FR-AUTH-01, và bước 1 của FR-AUTH-02). Supabase gửi thư
 * xác minh (mẫu tiếng Việt ở `supabase/templates`); chưa bấm liên kết thì chưa đăng nhập được.
 * Lỗi không làm mất ô đã nhập.
 */
export function RegisterForm({ intent = 'buyer', wizardPath }: RegisterFormProps) {
  const household = intent === 'household';
  const t = useTranslations('auth');
  const locale = useLocale();
  const message = useValidationMessage();
  const kiln = useKilnFeedback();
  const [error, setError] = useState<AuthErrorKey | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    mode: 'onTouched',
    defaultValues: { email: '', password: '', consent: false },
  });
  // Google sign-up needs the same consent box ticked first (GH#122).
  const consented = useWatch({ control, name: 'consent' });

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
      const supabase = browserSupabase();
      if (!supabase) return failWith('unconfigured');
      try {
        const { error: failure } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              locale,
              // The API records the sign-up consent from this when the account is first created.
              privacy_policy_version: PRIVACY_POLICY_VERSION,
              ...(household && wizardPath ? { next: wizardPath } : {}),
            },
          },
        });
        if (failure) return failWith(authErrorKey(failure));
        // Email đã có tài khoản cũng ra màn này (Supabase che), nên không lộ email nào đã đăng ký.
        // The form swaps to the check-email panel, so there is no stamp: just clear the card.
        kiln.reset();
        setSentTo(email);
      } catch (failure) {
        failWith(authErrorKey(failure));
      }
    },
    () => kiln.fail('invalid'),
  );

  if (sentTo) {
    return <CheckEmailPanel email={sentTo} {...(wizardPath ? { signInNext: wizardPath } : {})} />;
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
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
      <PasswordField
        label={t('fields.password')}
        hint={t('fields.passwordHint')}
        autoComplete="new-password"
        error={message(errors.password)}
        {...register('password')}
      />
      <ConsentCheckbox
        id="register-consent"
        purpose="account"
        error={message(errors.consent)}
        {...register('consent')}
      />
      <p className="text-small text-ash">{t('register.verifyNote')}</p>
      <Button type="submit" size="lg" disabled={isSubmitting}>
        {isSubmitting
          ? t('register.submitting')
          : household
            ? t('wizard.account.submit')
            : t('register.submit')}
      </Button>
      <p className="text-center text-small text-ash">{t('google.or')}</p>
      <GoogleSignIn next={wizardPath ?? null} disabled={!consented} />
      <div className="flex flex-col text-small">
        <p className="py-2.5 text-ash">
          {household ? t('wizard.account.haveAccount') : t('register.haveAccount')}{' '}
          <Link
            href={{
              pathname: '/dang-nhap',
              ...(household && wizardPath ? { query: { next: wizardPath } } : {}),
            }}
            className="text-clay underline underline-offset-4"
          >
            {household ? t('wizard.account.signInLink') : t('register.signInLink')}
          </Link>
        </p>
        {household ? null : (
          <Link href="/dang-ky-nghe-nhan" className={STANDALONE_LINK}>
            {t('register.householdLink')}
          </Link>
        )}
      </div>
    </form>
  );
}
