'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { AccountApiError } from '@vcraft/api-client';
import { Button } from '@vcraft/ui';
import { useTranslations } from 'next-intl';
import { useId, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { useAddressSuggestions } from '@/lib/address/use-address-suggestions';
import { browserAccountClient } from '@/lib/auth/supabase-browser';
import { notify } from '@/lib/notify';
import { type AuthErrorKey, authErrorKey } from './auth-errors';
import { CheckboxField, FormAlert, SelectField, TextAreaField, TextField } from './fields';
import { LocationPicker } from './location-picker';
import { WORKSHOP_PURPOSES, type WorkshopStepValues, workshopStepSchema } from './schemas';
import { useValidationMessage } from './use-validation-message';

/**
 * Bước 3 của wizard: xưởng đầu tiên và vị trí chọn trên bản đồ (`POST /me/household/workshops`).
 * Tọa độ là bắt buộc để xưởng hiện được trên bản đồ làng sau khi hộ được chấp nhận.
 */
export function WizardWorkshopStep({ onDone }: { onDone: () => void }) {
  const t = useTranslations('auth');
  const message = useValidationMessage();
  const [error, setError] = useState<AuthErrorKey | null>(null);
  const {
    register,
    handleSubmit,
    setValue,
    setError: setFieldError,
    control,
    formState: { errors, isSubmitting },
  } = useForm<WorkshopStepValues>({
    resolver: zodResolver(workshopStepSchema),
    mode: 'onTouched',
    defaultValues: {
      name: '',
      address: '',
      purpose: 'PRODUCTION',
      acceptsVisitors: false,
      visitingInfo: '',
    },
  });
  const [lat, lng, acceptsVisitors, address] = useWatch({
    control,
    name: ['lat', 'lng', 'acceptsVisitors', 'address'],
  });
  const addressListId = useId();
  const addressSuggestions = useAddressSuggestions(address ?? '');
  const position = typeof lat === 'number' && typeof lng === 'number' ? { lat, lng } : null;

  const onSubmit = handleSubmit(async (values) => {
    setError(null);
    try {
      await browserAccountClient().addWorkshop({
        name: values.name,
        address: values.address,
        purpose: values.purpose,
        acceptsVisitors: values.acceptsVisitors,
        temporarilyClosed: false,
        ...(values.acceptsVisitors && values.visitingInfo
          ? { visitingInfo: values.visitingInfo }
          : {}),
        lat: values.lat,
        lng: values.lng,
      });
      notify.success(t('wizard.workshop.savedToast'));
      onDone();
    } catch (failure) {
      if (failure instanceof AccountApiError && failure.fieldErrors.length > 0) {
        for (const { path, message: text } of failure.fieldErrors) {
          if (path === 'name' || path === 'address' || path === 'visitingInfo') {
            setFieldError(path, { message: text });
          }
        }
        return;
      }
      setError(authErrorKey(failure));
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      {error ? <FormAlert tone="error">{t(`errors.${error}`)}</FormAlert> : null}
      <TextField
        label={t('wizard.workshop.name')}
        placeholder={t('wizard.workshop.namePlaceholder')}
        error={message(errors.name)}
        {...register('name')}
      />
      <TextField
        label={t('wizard.workshop.address')}
        placeholder={t('wizard.workshop.addressPlaceholder')}
        autoComplete="off"
        list={addressListId}
        error={message(errors.address)}
        {...register('address')}
      />
      <datalist id={addressListId}>
        {addressSuggestions.map((option) => (
          <option key={option} value={option} />
        ))}
      </datalist>
      <SelectField label={t('wizard.workshop.purpose')} {...register('purpose')}>
        {WORKSHOP_PURPOSES.map((purpose) => (
          <option key={purpose} value={purpose}>
            {t(`wizard.workshop.purposes.${purpose}`)}
          </option>
        ))}
      </SelectField>
      <CheckboxField
        label={t('wizard.workshop.acceptsVisitors')}
        {...register('acceptsVisitors')}
      />
      {acceptsVisitors ? (
        <TextAreaField
          label={t('wizard.workshop.visitingInfo')}
          optionalLabel={t('fields.optional')}
          hint={t('wizard.workshop.visitingInfoHint')}
          error={message(errors.visitingInfo)}
          {...register('visitingInfo')}
        />
      ) : null}

      <LocationPicker
        value={position}
        error={message(errors.lat ?? errors.lng)}
        onChange={(next) => {
          // `undefined` (chưa chọn) để schema báo "hãy chọn vị trí"; không lưu số rác.
          setValue('lat', next?.lat as number, { shouldValidate: true, shouldDirty: true });
          setValue('lng', next?.lng as number, { shouldValidate: true, shouldDirty: true });
        }}
      />

      <Button type="submit" size="lg" disabled={isSubmitting}>
        {isSubmitting ? t('wizard.workshop.submitting') : t('wizard.workshop.submit')}
      </Button>
    </form>
  );
}
