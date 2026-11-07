'use client';

import type { QuotationClient } from '@vcraft/api-client';
import { RFQ_MAX_ATTACHMENTS, type RfqAttachmentDto } from '@vcraft/contracts';
import { MEDIA_MAX_BYTES } from '@vcraft/domain';
import { Button, buttonVariants, cn } from '@vcraft/ui';
import { useFormatter, useTranslations } from 'next-intl';
import { useRef, useState } from 'react';
import { sendMedia } from '@/features/media/prepare-image';
import { browserAccessToken } from '@/lib/api/live-session';
import type { RfqAttachmentValue } from './rfq-form-model';

/** Same types the private bucket takes (`upload-policy` of the domain); the API still checks the magic bytes. */
const ACCEPTED_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
  'application/pdf',
] as const;

type AttachmentProblem = 'attachmentsErrorType' | 'attachmentsErrorSize' | 'attachmentsErrorUpload';

/** Checks a file in the browser so the error shows at once, before any bandwidth is spent. */
export function precheckAttachment(file: Pick<File, 'type' | 'size'>): AttachmentProblem | null {
  if (!(ACCEPTED_TYPES as readonly string[]).includes(file.type)) return 'attachmentsErrorType';
  if (file.size > MEDIA_MAX_BYTES) return 'attachmentsErrorSize';
  return null;
}

/** Sends a file as a request attachment. Private files are ready as soon as the upload returns. */
export async function uploadAttachment(file: File): Promise<RfqAttachmentValue> {
  const { signal } = new AbortController();
  const uploaded = await sendMedia(
    file,
    'RFQ_ATTACHMENT',
    browserAccessToken() ?? (async () => null),
    () => {},
    signal,
  );
  return {
    id: uploaded.id,
    name: file.name,
    mimeType: uploaded.mimeType,
    sizeBytes: uploaded.sizeBytes,
  };
}

function useSize() {
  const format = useFormatter();
  return (bytes: number) =>
    bytes < 1024 * 1024
      ? `${format.number(Math.max(1, Math.round(bytes / 1024)))} KB`
      : `${format.number(bytes / 1024 / 1024, { maximumFractionDigits: 1 })} MB`;
}

/** Up to three logo or drawing files for a request (FR-RFQ-01), uploaded to the private bucket. */
export function AttachmentsField({
  value,
  onChange,
  onBusyChange,
  upload = uploadAttachment,
}: {
  value: readonly RfqAttachmentValue[];
  onChange: (next: RfqAttachmentValue[]) => void;
  onBusyChange?: (busy: boolean) => void;
  upload?: (file: File) => Promise<RfqAttachmentValue>;
}) {
  const t = useTranslations('rfq.form');
  const detail = useTranslations('rfq.detail');
  const size = useSize();
  const input = useRef<HTMLInputElement>(null);
  const [problem, setProblem] = useState<AttachmentProblem | null>(null);
  const [uploading, setUploading] = useState(0);
  const pending = useRef(0);
  // Uploads that finish while others run must not overwrite each other's result.
  const current = useRef<readonly RfqAttachmentValue[]>(value);
  current.current = value;
  const full = value.length + uploading >= RFQ_MAX_ATTACHMENTS;

  const add = async (files: FileList | null) => {
    if (!files) return;
    setProblem(null);
    const room = RFQ_MAX_ATTACHMENTS - current.current.length - uploading;
    const picked = Array.from(files).slice(0, Math.max(0, room));
    if (input.current) input.current.value = '';
    for (const file of picked) {
      const rejected = precheckAttachment(file);
      if (rejected) {
        setProblem(rejected);
        continue;
      }
      pending.current += 1;
      setUploading(pending.current);
      onBusyChange?.(true);
      try {
        const uploaded = await upload(file);
        current.current = [...current.current, uploaded];
        onChange([...current.current]);
      } catch {
        setProblem('attachmentsErrorUpload');
      } finally {
        pending.current -= 1;
        setUploading(pending.current);
        if (pending.current === 0) onBusyChange?.(false);
      }
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <span id="rfq-attachments-label">{t('attachments')}</span>
      <p className="text-small text-ash">{t('attachmentsHint')}</p>
      {value.length > 0 ? (
        <ul aria-label={t('attachments')} className="flex flex-col gap-2">
          {value.map((file, index) => (
            <li
              key={file.id}
              className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-card bg-ink/4 px-4 py-2"
            >
              <span className="min-w-0 flex-1 truncate text-small font-medium text-ink">
                {file.name || detail('attachmentName', { n: index + 1 })}
                <span className="ml-2 font-normal text-ash">{size(file.sizeBytes)}</span>
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-label={t('attachmentsRemove', {
                  name: file.name || detail('attachmentName', { n: index + 1 }),
                })}
                onClick={() => {
                  setProblem(null);
                  onChange(value.filter((other) => other.id !== file.id));
                }}
              >
                ×
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="flex flex-wrap items-center gap-3">
        <label
          className={cn(
            buttonVariants({ variant: 'secondary' }),
            'cursor-pointer has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-glaze',
            full && 'cursor-not-allowed opacity-50',
          )}
        >
          {t('attachmentsPick')}
          <input
            ref={input}
            type="file"
            multiple
            disabled={full}
            aria-labelledby="rfq-attachments-label"
            accept={ACCEPTED_TYPES.join(',')}
            className="sr-only"
            onChange={(event) => void add(event.currentTarget.files)}
          />
        </label>
        {uploading > 0 ? (
          <p role="status" className="text-small text-ash">
            {t('attachmentsUploading')}
          </p>
        ) : full ? (
          <p className="text-small text-ash">{t('attachmentsFull')}</p>
        ) : null}
      </div>
      {problem ? (
        <p role="alert" className="text-small text-seal">
          {t(problem)}
        </p>
      ) : null}
    </div>
  );
}

const kind = (mimeType: string) => (mimeType === 'application/pdf' ? 'Pdf' : 'Image');

/** The files attached to a request, each opened through a short-lived signed link (private files). */
export function RequestAttachments({
  attachments,
  client,
}: {
  attachments: readonly RfqAttachmentDto[];
  client: QuotationClient;
}) {
  const t = useTranslations('rfq.detail');
  const size = useSize();
  const [failed, setFailed] = useState(false);

  const open = async (id: string) => {
    setFailed(false);
    try {
      const { url } = await client.getMediaReadUrl(id);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch {
      setFailed(true);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <ul className="flex flex-col gap-2">
        {attachments.map((file, index) => (
          <li key={file.id} className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="min-w-0 break-words">
              {t('attachmentName', { n: index + 1 })}
              <span className="ml-2 text-small text-ash">
                {t(`attachmentKind${kind(file.mimeType)}`)} · {size(file.sizeBytes)}
              </span>
            </span>
            <Button type="button" variant="secondary" size="sm" onClick={() => void open(file.id)}>
              {t('attachmentOpen')}
            </Button>
          </li>
        ))}
      </ul>
      {failed ? (
        <p role="alert" className="text-small text-seal">
          {t('attachmentOpenFailed')}
        </p>
      ) : null}
    </div>
  );
}
