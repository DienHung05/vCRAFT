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
import { SlugAvailabilityNote } from '@/features/studio/slug-availability-note';
import { useSlugAvailability } from '@/features/studio/use-slug-availability';
import { getPathname } from '@/i18n/navigation';
import { ACCOUNT_CHANGED_EVENT } from '@/lib/auth/household-intent';
import { browserAccountClient } from '@/lib/auth/supabase-browser';
import { notify } from '@/lib/notify';
import { type AuthErrorKey, authErrorKey } from './auth-errors';
import { FormAlert, TextAreaField, TextField } from './fields';
import { type HouseholdStepValues, householdStepSchema, serverFieldMessageKey } from './schemas';
import { useValidationMessage } from './use-validation-message';

/**
 * Bước 2 của wizard: thông tin hộ. Gửi `POST /me/household` ⇒ hồ sơ ở trạng thái `DRAFT` (chỉ vào
 * hàng đợi duyệt khi nộp ở bước cuối) và tài khoản thành người đại diện hộ (xưởng, giấy tờ ở hai bước sau cần vai trò đó). Đường dẫn trang tự sinh từ
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
  // The citizen ID number is required here, and the API needs the ID_DOCUMENT consent to take it (GH#455).
  const [needsIdConsent, setNeedsIdConsent] = useState(true);
  const [idConsent, setIdConsent] = useState(false);
  const [idConsentMissing, setIdConsentMissing] = useState(false);
  useEffect(() => {
    let active = true;
    browserAccountClient()
      .listConsents()
      .then((list) => {
        const given = list.data.some(
          (item) => item.purpose === 'SIGN_UP' && item.policyVersion === list.currentPolicyVersion,
        );
        const idGiven = list.data.some(
          (item) =>
            item.purpose === 'ID_DOCUMENT' &&
            item.policyVersion === list.currentPolicyVersion &&
            !item.withdrawnAt,
        );
        if (active) {
          setNeedsConsent(!given);
          setNeedsIdConsent(!idGiven);
        }
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
    defaultValues: { name: '', slug: '', village: '', idNumber: '', history: '' },
  });
  const slug = useWatch({ control, name: 'slug' });
  // FR-ART-01: tell the applicant right away when the address is already taken.
  const slugCheck = useSlugAvailability(slug, (value) =>
    browserAccountClient().slugAvailability(value),
  );

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
    if (needsConsent && !consent) setConsentMissing(true);
    if (needsIdConsent && !idConsent) setIdConsentMissing(true);
    if ((needsConsent && !consent) || (needsIdConsent && !idConsent)) return;
    try {
      if (needsConsent) {
        await browserAccountClient().recordConsent('SIGN_UP', PRIVACY_POLICY_VERSION);
      }
      if (needsIdConsent) {
        await browserAccountClient().recordConsent('ID_DOCUMENT', PRIVACY_POLICY_VERSION);
      }
      await browserAccountClient().applyHousehold({
        name: values.name,
        slug: values.slug,
        history: values.history,
        idNumber: values.idNumber,
        ...(values.village ? { village: values.village } : {}),
      });
      notify.success(t('wizard.household.savedToast'));
      // The account is a household representative now: let the header menu reload its role.
      window.dispatchEvent(new Event(ACCOUNT_CHANGED_EVENT));
      onDone();
    } catch (failure) {
      if (failure instanceof AccountApiError && failure.fieldErrors.length > 0) {
        for (const { path, code } of failure.fieldErrors) {
          if (
            path === 'name' ||
            path === 'slug' ||
            path === 'village' ||
            path === 'idNumber' ||
            path === 'history'
          ) {
            setFieldError(path, { message: serverFieldMessageKey(path, code) });
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
      <div className="flex flex-col gap-2">
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
        <SlugAvailabilityNote
          state={slugCheck}
          labels={{
            checking: t('wizard.household.slugChecking'),
            available: t('wizard.household.slugAvailable'),
            taken: t('wizard.household.slugTaken'),
            takenSuggest: (suggestion) =>
              t('wizard.household.slugTakenSuggest', { slug: suggestion }),
            applySuggestion: (suggestion) =>
              t('wizard.household.slugUseSuggestion', { slug: suggestion }),
            failed: t('wizard.household.slugCheckFailed'),
          }}
          onUseSuggestion={(suggestion) => {
            slugEdited.current = true;
            setValue('slug', suggestion, { shouldValidate: true });
          }}
        />
      </div>
      <TextField
        label={t('wizard.household.village')}
        optionalLabel={t('fields.optional')}
        placeholder={t('wizard.household.villagePlaceholder')}
        error={message(errors.village)}
        {...register('village')}
      />
      <TextField
        label={t('wizard.household.idNumber')}
        hint={t('wizard.household.idNumberHint')}
        inputMode="numeric"
        autoComplete="off"
        maxLength={12}
        spellCheck={false}
        error={message(errors.idNumber)}
        {...register('idNumber')}
      />
      {needsIdConsent ? (
        <ConsentCheckbox
          id="household-id-consent"
          purpose="household"
          checked={idConsent}
          onChange={(event) => {
            setIdConsent(event.target.checked);
            setIdConsentMissing(false);
          }}
          error={idConsentMissing ? t('validation.consentRequired') : undefined}
        />
      ) : null}
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
