'use client';

import { MEDIA_MAX_BYTES, PRIVACY_POLICY_VERSION } from '@vcraft/domain';
import { Badge, Button, buttonVariants, cn } from '@vcraft/ui';
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

/** What the file evidences, picked by the applicant and stored on the private asset (vCRAFT-8my.3). */
const KINDS = ['IDENTITY', 'RESIDENCE', 'WORKSHOP'] as const;
export type DocumentKind = (typeof KINDS)[number];
/** The stored kind read back from the asset; legacy files answer UNKNOWN. */
type StoredKind = DocumentKind | 'UNKNOWN';

interface UploadItem {
  readonly id: string;
  readonly file: File;
  readonly kind: StoredKind;
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
export function DocumentUpload({ embedded = false }: { embedded?: boolean } = {}) {
  const t = useTranslations('auth.wizard.documents');
  const errors = useTranslations('auth.errors');
  const format = useFormatter();
  const locale = useLocale();
  const [items, setItems] = useState<readonly UploadItem[]>([]);
  const [submitting, setSubmitting] = useState(false);
  // Identity papers are only collected after the representative agrees to the privacy policy.
  const [consent, setConsent] = useState(false);
  /** What the picked files evidence; applied to every file added while it is selected. */
  const [kind, setKind] = useState<DocumentKind>('IDENTITY');
  const kindRef = useRef<DocumentKind>('IDENTITY');
  // Keep the ref in sync during render so `add` always reads the selected kind.
  kindRef.current = kind;
  const input = useRef<HTMLInputElement>(null);
  // The API refuses identity papers without a recorded consent, so it is recorded once, before the first file.
  const consentRecorded = useRef<Promise<unknown> | null>(null);

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
      consentRecorded.current ??= browserAccountClient().recordConsent(
        'ID_DOCUMENT',
        PRIVACY_POLICY_VERSION,
      );
      await consentRecorded.current.catch((failure: unknown) => {
        consentRecorded.current = null;
        throw failure;
      });
      // The answer carries the stored kind back; the server may keep a previous classification
      // when identical bytes were uploaded before (vCRAFT-8my.3).
      const asset = await browserAccountClient().uploadCertificate(
        item.file,
        item.file.name,
        item.kind,
      );
      patch(item.id, {
        status: 'done',
        kind: (asset.certificateKind ?? 'UNKNOWN') as StoredKind,
      });
    } catch (failure) {
      patch(item.id, { status: 'error', error: authErrorKey(failure) });
    }
  };

  const add = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    // Read through the ref so a file picked before a re-render still carries the selected kind.
    const kind = kindRef.current;
    const fresh: UploadItem[] = Array.from(files).map((file) => {
      const problem = precheckDocument(file);
      return {
        id: crypto.randomUUID(),
        file,
        kind,
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
        <label className="flex flex-col gap-1 text-small">
          {t('kind')}
          <select
            value={kind}
            onChange={(event) => setKind(event.target.value as DocumentKind)}
            className="rounded-input border border-ink/20 bg-surface px-2 py-1.5"
          >
            {KINDS.map((value) => (
              <option key={value} value={value}>
                {t(`kindOption.${value}`)}
              </option>
            ))}
          </select>
        </label>
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
              <Badge tone="outline">{t(`kindOption.${item.kind}`)}</Badge>
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

      {!embedded && done === 0 && !busy ? (
        <FormAlert tone="info">{t('needOne')}</FormAlert>
      ) : busy ? (
        <FormAlert tone="info">{t('waitUploads')}</FormAlert>
      ) : null}

      {!embedded ? (
        <Button type="button" size="lg" onClick={submit} disabled={!canSubmit}>
          {submitting ? t('submitting') : t('submit')}
        </Button>
      ) : null}
    </div>
  );
}
