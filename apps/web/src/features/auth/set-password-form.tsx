'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@vcraft/ui';
import { useLocale, useTranslations } from 'next-intl';
import { useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from '@/i18n/navigation';
import { browserSupabase } from '@/lib/auth/supabase-browser';
import { type AuthErrorKey, authErrorKey } from './auth-errors';
import { FormAlert, PasswordField } from './fields';
import { type SetPasswordValues, setPasswordSchema } from './schemas';
import { useValidationMessage } from './use-validation-message';

export type SetPasswordMode = 'recovery' | 'invite';

export interface SetPasswordFormProps {
  mode: SetPasswordMode;
  /** `token_hash` trong liên kết của thư (dùng một lần); không có thì cần đã có phiên đăng nhập. */
  tokenHash: string | null;
  /** Server thấy cookie phiên hợp lệ (người đang đăng nhập muốn đổi mật khẩu). */
  hasSession: boolean;
}

/**
 * Đặt mật khẩu từ liên kết một lần trong thư: quên mật khẩu (FR-AUTH-06) hoặc lời mời của Ban quản lý
 * (FR-AUTH-03). Mã trong liên kết chỉ bị tiêu thụ khi người dùng bấm gửi (không phải lúc mở trang),
 * nên trình quét liên kết của hộp thư không làm hỏng liên kết. Sau khi đổi mật khẩu quên, các thiết bị
 * khác bị đăng xuất.
 */
export function SetPasswordForm({ mode, tokenHash, hasSession }: SetPasswordFormProps) {
  const t = useTranslations('auth');
  const locale = useLocale();
  const message = useValidationMessage();
  const [error, setError] = useState<AuthErrorKey | null>(null);
  const [linkInvalid, setLinkInvalid] = useState(false);
  // Mã dùng một lần: đã xác minh thành công thì lần gửi lại (vd. mật khẩu bị từ chối) không xác minh lại.
  const verified = useRef(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SetPasswordValues>({
    resolver: zodResolver(setPasswordSchema),
    mode: 'onTouched',
    defaultValues: { password: '', confirm: '' },
  });
  const copy = mode === 'invite' ? 'invitation' : 'reset';

  if (linkInvalid || (!tokenHash && !hasSession)) return <InvalidLink mode={mode} />;

  const onSubmit = handleSubmit(async ({ password }) => {
    setError(null);
    const supabase = browserSupabase();
    if (!supabase) return setError('unconfigured');
    try {
      if (tokenHash && !verified.current) {
        const { error: failure } = await supabase.auth.verifyOtp({
          type: mode === 'invite' ? 'invite' : 'recovery',
          token_hash: tokenHash,
        });
        if (failure) {
          const key = authErrorKey(failure);
          return key === 'link_invalid' ? setLinkInvalid(true) : setError(key);
        }
        verified.current = true;
      }
      const { error: failure } = await supabase.auth.updateUser({ password });
      if (failure) return setError(authErrorKey(failure));
      // FR-AUTH-06: đổi mật khẩu thì đăng xuất các thiết bị khác, giữ thiết bị này.
      if (mode === 'recovery') await supabase.auth.signOut({ scope: 'others' });
      window.location.assign(`/auth/continue?locale=${locale}`);
    } catch (failure) {
      setError(authErrorKey(failure));
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      {error ? <FormAlert tone="error">{t(`errors.${error}`)}</FormAlert> : null}
      <PasswordField
        label={t('fields.newPassword')}
        hint={t('fields.passwordHint')}
        autoComplete="new-password"
        error={message(errors.password)}
        {...register('password')}
      />
      <PasswordField
        label={t('fields.confirmPassword')}
        autoComplete="new-password"
        error={message(errors.confirm)}
        {...register('confirm')}
      />
      <Button type="submit" size="lg" disabled={isSubmitting}>
        {isSubmitting ? t(`${copy}.submitting`) : t(`${copy}.submit`)}
      </Button>
    </form>
  );
}

/** Liên kết hết hạn, đã dùng hoặc không có: chỉ cách xin liên kết mới, không lộ chi tiết kỹ thuật. */
function InvalidLink({ mode }: { mode: SetPasswordMode }) {
  const t = useTranslations('auth');
  const copy = mode === 'invite' ? 'invitation' : 'reset';
  return (
    <div className="flex flex-col gap-4" role="alert">
      <h2 className="font-display text-h3 text-glaze">{t(`${copy}.invalidTitle`)}</h2>
      <p>{t(`${copy}.invalid`)}</p>
      {mode === 'recovery' ? (
        <Link href="/quen-mat-khau" className="text-small text-clay underline underline-offset-4">
          {t('reset.requestNew')}
        </Link>
      ) : (
        <Link href="/dang-nhap" className="text-small text-clay underline underline-offset-4">
          {t('invitation.signInLink')}
        </Link>
      )}
    </div>
  );
}
