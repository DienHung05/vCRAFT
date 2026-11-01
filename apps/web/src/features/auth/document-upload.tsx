'use client';

import { MEDIA_MAX_BYTES } from '@vcraft/domain';
import { Button, buttonVariants, cn } from '@vcraft/ui';
import { useFormatter, useLocale, useTranslations } from 'next-intl';
import { useRef, useState } from 'react';
import { ConsentCheckbox } from '@/components/consent-checkbox';
import { getPathname } from '@/i18n/navigation';
import { browserAccountClient } from '@/lib/auth/supabase-browser';
import { type AuthErrorKey, authErrorKey } from './auth-errors';
import { FormAlert } from './fields';

/** Loại tệp bucket riêng tư nhận (khớp `upload-policy` của domain); API vẫn kiểm lại bằng magic bytes. */
const ACCEPTED_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
  'application/pdf',
] as const;

type ItemStatus = 'queued' | 'uploading' | 'done' | 'error';

interface UploadItem {
  readonly id: string;
  readonly file: File;
  readonly status: ItemStatus;
  readonly error?: AuthErrorKey;
}

/** Kiểm tra ngay ở trình duyệt để lỗi hiện tức thì, trước khi tốn băng thông. */
export function precheckDocument(file: Pick<File, 'type' | 'size'>): AuthErrorKey | null {
  if (!(ACCEPTED_TYPES as readonly string[]).includes(file.type)) return 'mediaUnsupported';
  if (file.size > MEDIA_MAX_BYTES) return 'mediaTooLarge';
  return null;
}

/**
 * Tải giấy tờ xác minh hộ lên bucket riêng tư qua `POST /media?purpose=CERTIFICATE` (FR-AUTH-02,
 * FR-MEDIA-04). Mỗi tệp có trạng thái riêng, lỗi một tệp không chặn tệp khác, thử lại được.
 * Bước này chỉ cho nộp hồ sơ khi có ít nhất một tệp đã tải xong và không còn tệp đang chạy.
 */
export function DocumentUpload() {
  const t = useTranslations('auth.wizard.documents');
  const errors = useTranslations('auth.errors');
  const format = useFormatter();
  const locale = useLocale();
  const [items, setItems] = useState<readonly UploadItem[]>([]);
  const [submitting, setSubmitting] = useState(false);
  // Identity papers are only collected after the representative agrees to the privacy policy.
  const [consent, setConsent] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const patch = (id: string, change: Partial<Omit<UploadItem, 'id' | 'file'>>) =>
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const { error: _drop, ...rest } = item;
        return { ...rest, ...change };
      }),
    );

  const upload = async (item: UploadItem) => {
    patch(item.id, { status: 'uploading' });
    try {
      await browserAccountClient().uploadCertificate(item.file, item.file.name);
      patch(item.id, { status: 'done' });
    } catch (failure) {
      patch(item.id, { status: 'error', error: authErrorKey(failure) });
    }
  };

  const add = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const fresh: UploadItem[] = Array.from(files).map((file) => {
      const problem = precheckDocument(file);
      return {
        id: crypto.randomUUID(),
        file,
        status: problem ? 'error' : 'queued',
        ...(problem ? { error: problem } : {}),
      };
    });
    setItems((prev) => [...prev, ...fresh]);
    if (input.current) input.current.value = '';
    for (const item of fresh) {
      if (item.status === 'queued') await upload(item);
    }
  };

  const done = items.filter((item) => item.status === 'done').length;
  const busy = items.some((item) => item.status === 'queued' || item.status === 'uploading');
  const canSubmit = done > 0 && !busy && !submitting;

  const submit = () => {
    setSubmitting(true);
    // Hồ sơ đã ở `PENDING_REVIEW` từ bước thông tin hộ; chuyển tới trang trạng thái để hộ thấy kết quả.
    window.location.assign(
      `${getPathname({ href: '/studio/ho-so', locale: locale as 'vi' | 'en' })}?submitted=1`,
    );
  };

  return (
    <div className="flex flex-col gap-5">
      <ConsentCheckbox
        id="documents-consent"
        purpose="household"
        checked={consent}
        onChange={(event) => setConsent(event.target.checked)}
      />
      <div className="flex flex-col items-start gap-2">
        <label
          className={cn(
            buttonVariants({ variant: 'secondary' }),
            'cursor-pointer has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-glaze',
            !consent && 'cursor-not-allowed opacity-50',
          )}
        >
          {t('pick')}
          <input
            ref={input}
            type="file"
            multiple
            disabled={!consent}
            accept={ACCEPTED_TYPES.join(',')}
            className="sr-only"
            onChange={(event) => void add(event.currentTarget.files)}
          />
        </label>
        <p className="text-small text-ash">{consent ? t('drop') : t('consentFirst')}</p>
      </div>

      {items.length === 0 ? (
        <p className="text-small text-ash">{t('empty')}</p>
      ) : (
        <ul aria-label={t('listLabel')} aria-live="polite" className="flex flex-col gap-2">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-card bg-ink/4 px-4 py-3"
            >
              <span className="min-w-0 flex-1 truncate text-small font-medium text-ink">
                {item.file.name}
                <span className="ml-2 font-normal text-ash">
                  {item.file.size < 1024 * 1024
                    ? `${format.number(Math.max(1, Math.round(item.file.size / 1024)))} KB`
                    : `${format.number(item.file.size / 1024 / 1024, { maximumFractionDigits: 1 })} MB`}
                </span>
              </span>
              <span
                className={cn(
                  'text-small',
                  item.status === 'error' ? 'text-seal' : 'text-ash',
                  item.status === 'done' && 'text-ink',
                )}
              >
                {item.status === 'error' && item.error
                  ? errors(item.error)
                  : t(`status.${item.status}`)}
              </span>
              {item.status === 'error' && !precheckDocument(item.file) ? (
                <Button type="button" variant="ghost" size="sm" onClick={() => void upload(item)}>
                  {t('retry')}
                </Button>
              ) : null}
              {item.status !== 'uploading' ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-label={t('remove', { name: item.file.name })}
                  onClick={() => setItems((prev) => prev.filter((other) => other.id !== item.id))}
                >
                  ×
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {done === 0 && !busy ? (
        <FormAlert tone="info">{t('needOne')}</FormAlert>
      ) : busy ? (
        <FormAlert tone="info">{t('waitUploads')}</FormAlert>
      ) : null}

      <Button type="button" size="lg" onClick={submit} disabled={!canSubmit}>
        {submitting ? t('submitting') : t('submit')}
      </Button>
    </div>
  );
}
