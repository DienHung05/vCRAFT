'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@vcraft/ui';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { type AuthErrorKey, authErrorKey } from '@/features/auth/auth-errors';
import { FormAlert, PasswordField } from '@/features/auth/fields';
import { type ChangePasswordValues, changePasswordSchema } from '@/features/auth/schemas';
import { useValidationMessage } from '@/features/auth/use-validation-message';
import { browserSupabase } from '@/lib/auth/supabase-browser';
import { notify } from '@/lib/notify';

type FailureKey = AuthErrorKey | 'currentWrong';

/**
 * Đổi mật khẩu khi đã đăng nhập (GH#37, FR-AUTH-06): xác nhận mật khẩu hiện tại bằng Supabase, đặt
 * mật khẩu mới, rồi đăng xuất mọi thiết bị khác (`scope: 'others'`), giữ phiên của thiết bị này.
 * Mọi bước đi qua Supabase Auth; vCraft không thấy hay lưu mật khẩu.
 */
export function ChangePasswordForm({ email }: { email: string }) {
  const t = useTranslations('account.password');
  const tAuth = useTranslations('auth');
  const message = useValidationMessage();
  const [error, setError] = useState<FailureKey | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ChangePasswordValues>({
    resolver: zodResolver(changePasswordSchema),
    mode: 'onTouched',
    defaultValues: { current: '', password: '', confirm: '' },
  });

  const onSubmit = handleSubmit(async ({ current, password }) => {
    setError(null);
    const supabase = browserSupabase();
    if (!supabase) return setError('unconfigured');
    try {
      const verified = await supabase.auth.signInWithPassword({ email, password: current });
      if (verified.error) {
        const key = authErrorKey(verified.error);
        return setError(key === 'invalid_credentials' ? 'currentWrong' : key);
      }
      const updated = await supabase.auth.updateUser({ password });
      if (updated.error) return setError(authErrorKey(updated.error));
      const others = await supabase.auth.signOut({ scope: 'others' });
      if (others.error) return setError(authErrorKey(others.error));
      reset();
      notify.success(t('success'));
    } catch (failure) {
      setError(authErrorKey(failure));
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      {error ? (
        <FormAlert tone="error">
          {error === 'currentWrong' ? t('currentWrong') : tAuth(`errors.${error}`)}
        </FormAlert>
      ) : null}
      <PasswordField
        label={t('current')}
        autoComplete="current-password"
        error={message(errors.current)}
        {...register('current')}
      />
      <PasswordField
        label={tAuth('fields.newPassword')}
        hint={tAuth('fields.passwordHint')}
        autoComplete="new-password"
        error={message(errors.password)}
        {...register('password')}
      />
      <PasswordField
        label={tAuth('fields.confirmPassword')}
        autoComplete="new-password"
        error={message(errors.confirm)}
        {...register('confirm')}
      />
      <Button type="submit" size="lg" disabled={isSubmitting}>
        {isSubmitting ? t('submitting') : t('submit')}
      </Button>
    </form>
  );
}
