'use client';

import { useTranslations } from 'next-intl';
import { isValidationKey } from './schemas';

/** Dịch khóa lỗi của schema (`auth.validation.*`) thành câu hiển thị; lỗi lạ giữ nguyên chữ. */
export function useValidationMessage() {
  const t = useTranslations('auth.validation');
  return (error: { message?: string | undefined } | undefined): string | undefined => {
    const message = error?.message;
    if (!message) return undefined;
    return isValidationKey(message) ? t(message) : message;
  };
}
