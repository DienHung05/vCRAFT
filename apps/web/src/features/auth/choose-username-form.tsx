'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@vcraft/ui';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { browserSupabase } from '@/lib/auth/supabase-browser';
import { type AuthErrorKey, authErrorKey } from './auth-errors';
import { FormAlert, TextField } from './fields';
import { chooseUsernameSchema } from './schemas';
import { useValidationMessage } from './use-validation-message';
import { UsernameAvailability } from './username-availability';

export function ChooseUsernameForm({ next }: { next: string | null }) {
  const t = useTranslations('auth');
  const locale = useLocale();
  const message = useValidationMessage();
  const [error, setError] = useState<AuthErrorKey | null>(null);
  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<{ username: string }>({
    resolver: zodResolver(chooseUsernameSchema),
    defaultValues: { username: '' },
    mode: 'onTouched',
  });
  const username = useWatch({ control, name: 'username' });
  const submit = handleSubmit(async (body) => {
    setError(null);
    try {
      const supabase = browserSupabase();
      const token = (await supabase?.auth.getSession())?.data.session?.access_token;
      if (!token) return setError('sessionExpired');
      const response = await fetch('/api/v1/me/username', {
        method: 'PUT',
        cache: 'no-store',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const data = await response.json();
        throw Object.assign(new Error('Username could not be saved'), {
          code: data.code,
          status: response.status,
        });
      }
      window.location.assign(
        `/auth/continue?locale=${locale}${next ? `&next=${encodeURIComponent(next)}` : ''}`,
      );
    } catch (failure) {
      setError(authErrorKey(failure));
    }
  });
  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-5">
      {error ? <FormAlert tone="error">{t(`errors.${error}`)}</FormAlert> : null}
      <TextField
        label={t('fields.username')}
        autoComplete="username"
        autoCapitalize="none"
        spellCheck={false}
        hint={t('fields.usernameHint')}
        error={message(errors.username)}
        {...register('username')}
      />
      <UsernameAvailability username={username} />
      <Button type="submit" size="lg" disabled={isSubmitting}>
        {isSubmitting ? t('username.saving') : t('username.submit')}
      </Button>
    </form>
  );
}
