'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { AccountApiError } from '@vcraft/api-client';
import { PRIVACY_POLICY_VERSION } from '@vcraft/domain';
import { Button } from '@vcraft/ui';
import { slugify } from '@vcraft/utils';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { ConsentCheckbox } from '@/components/consent-checkbox';
import { getPathname } from '@/i18n/navigation';
import { browserAccountClient } from '@/lib/auth/supabase-browser';
import { notify } from '@/lib/notify';
import { type AuthErrorKey, authErrorKey } from './auth-errors';
import { FormAlert, TextAreaField, TextField } from './fields';
import { type HouseholdStepValues, householdStepSchema } from './schemas';
import { useValidationMessage } from './use-validation-message';

/**
 * Bước 2 của wizard: thông tin hộ. Gửi `POST /me/household` ⇒ hồ sơ vào `PENDING_REVIEW` và tài khoản
 * thành người đại diện hộ (xưởng, giấy tờ ở hai bước sau cần vai trò đó). Đường dẫn trang tự sinh từ
 * tên (bỏ dấu) cho tới khi người dùng tự sửa. Lỗi giữ nguyên mọi ô; lỗi theo field của API gắn đúng ô.
 */
export function WizardHouseholdStep({ onDone }: { onDone: () => void }) {
  const t = useTranslations('auth');
  const locale = useLocale();
  const message = useValidationMessage();
  const [error, setError] = useState<AuthErrorKey | null>(null);
  const slugEdited = useRef(false);
  // Accounts created through the sign-up form already have their consent on record (the API reads it
  // from the sign-up metadata). Anyone else is asked here, because the API refuses an application without it.
  const [needsConsent, setNeedsConsent] = useState(false);
  const [consent, setConsent] = useState(false);
  const [consentMissing, setConsentMissing] = useState(false);
  useEffect(() => {
    let active = true;
    browserAccountClient()
      .listConsents()
      .then((list) => {
        const given = list.data.some(
          (item) => item.purpose === 'SIGN_UP' && item.policyVersion === list.currentPolicyVersion,
        );
        if (active) setNeedsConsent(!given);
      })
      .catch(() => active && setNeedsConsent(true));
    return () => {
      active = false;
    };
  }, []);
  const {
    register,
    handleSubmit,
    setValue,
    setError: setFieldError,
    setFocus,
    control,
    formState: { errors, isSubmitting },
  } = useForm<HouseholdStepValues>({
    resolver: zodResolver(householdStepSchema),
    mode: 'onTouched',
    defaultValues: { name: '', slug: '', village: '', history: '' },
  });
  const slug = useWatch({ control, name: 'slug' });

  const slugRegistration = register('slug');
  const nameRegistration = register('name', {
    onChange: (event) => {
      // Gõ tên thì tự sinh đường dẫn; chạm vào ô đường dẫn rồi thì dừng ghi đè.
      if (!slugEdited.current) {
        setValue('slug', slugify(event.target.value), { shouldValidate: true });
      }
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    setError(null);
    if (needsConsent && !consent) {
      setConsentMissing(true);
      return;
    }
    try {
      if (needsConsent) {
        await browserAccountClient().recordConsent('SIGN_UP', PRIVACY_POLICY_VERSION);
      }
      await browserAccountClient().applyHousehold({
        name: values.name,
        slug: values.slug,
        history: values.history,
        ...(values.village ? { village: values.village } : {}),
      });
      notify.success(t('wizard.household.savedToast'));
      onDone();
    } catch (failure) {
      if (failure instanceof AccountApiError && failure.fieldErrors.length > 0) {
        for (const { path, message: text } of failure.fieldErrors) {
          if (path === 'name' || path === 'slug' || path === 'village' || path === 'history') {
            setFieldError(path, { message: text });
          }
        }
        return;
      }
      const key = authErrorKey(failure);
      setError(key);
      if (key === 'slugTaken') setFocus('slug');
    }
  });

  const pagePath = getPathname({
    href: {
      pathname: '/nghe-nhan/[slug]',
      params: { slug: slug || (locale === 'vi' ? 'ten-ho' : 'household-name') },
    },
    locale: locale as 'vi' | 'en',
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      {error ? <FormAlert tone="error">{t(`errors.${error}`)}</FormAlert> : null}
      <TextField
        label={t('wizard.household.name')}
        placeholder={t('wizard.household.namePlaceholder')}
        autoComplete="organization"
        error={message(errors.name)}
        {...nameRegistration}
      />
      <TextField
        label={t('wizard.household.slug')}
        hint={t('wizard.household.slugHint', { path: pagePath })}
        autoComplete="off"
        autoCapitalize="none"
        spellCheck={false}
        error={message(errors.slug)}
        {...slugRegistration}
        onChange={(event) => {
          slugEdited.current = true;
          return slugRegistration.onChange(event);
        }}
      />
      <TextField
        label={t('wizard.household.village')}
        optionalLabel={t('fields.optional')}
        placeholder={t('wizard.household.villagePlaceholder')}
        error={message(errors.village)}
        {...register('village')}
      />
      <TextAreaField
        label={t('wizard.household.history')}
        optionalLabel={t('fields.optional')}
        hint={t('wizard.household.historyHint')}
        error={message(errors.history)}
        {...register('history')}
      />
      {needsConsent ? (
        <ConsentCheckbox
          id="household-consent"
          purpose="account"
          checked={consent}
          onChange={(event) => {
            setConsent(event.target.checked);
            setConsentMissing(false);
          }}
          error={consentMissing ? t('validation.consentRequired') : undefined}
        />
      ) : null}
      <Button type="submit" size="lg" disabled={isSubmitting}>
        {isSubmitting ? t('wizard.household.submitting') : t('wizard.household.submit')}
      </Button>
    </form>
  );
}
