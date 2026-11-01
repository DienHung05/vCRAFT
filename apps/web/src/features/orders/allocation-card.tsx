'use client';

import type { QuotationClient } from '@vcraft/api-client';
import type { AllocationDto } from '@vcraft/contracts';
import { Button, Card } from '@vcraft/ui';
import { useFormatter, useTranslations } from 'next-intl';
import { type ReactNode, useState } from 'react';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { prepareImage, sendMedia } from '@/features/media/prepare-image';
import { browserAccessToken } from '@/lib/api/live-session';

const PHOTO_POLL_MS = 1500;
const PHOTO_POLL_ATTEMPTS = 20;

/** Uploads a progress photo and waits for the worker, because only processed images can be linked. */
async function uploadProgressPhoto(client: QuotationClient, file: File): Promise<string> {
  const { signal } = new AbortController();
  const prepared = await prepareImage(file, signal);
  const uploaded = await sendMedia(
    prepared.file,
    'JOURNAL',
    browserAccessToken() ?? (async () => null),
    () => {},
    signal,
  );
  for (let attempt = 0; attempt < PHOTO_POLL_ATTEMPTS; attempt++) {
    const asset = await client.getMedia(uploaded.id);
    if (asset.status === 'READY') return asset.id;
    if (asset.status === 'FAILED') break;
    await new Promise((resolve) => setTimeout(resolve, PHOTO_POLL_MS));
  }
  throw new Error('photo-not-ready');
}

/** One allocation of the household: confirm or decline, then quantity, note and photo (FR-ORD-07). */
export function AllocationCard({
  allocation,
  client,
  busy,
  run,
  uploadPhoto = uploadProgressPhoto,
  children,
  unit,
}: {
  allocation: AllocationDto;
  client: QuotationClient;
  busy: boolean;
  /** Runs an action, refreshes the data, and toasts `success` once it went through. */
  run: (action: () => Promise<unknown>, success?: string) => Promise<void>;
  uploadPhoto?: (client: QuotationClient, file: File) => Promise<string>;
  /** Order details shown above the numbers. */
  children?: ReactNode;
  unit?: string;
}) {
  const t = useTranslations('allocation');
  const format = useFormatter();
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);
  const [problem, setProblem] = useState<'invalidQty' | 'photoFailed' | null>(null);
  const [uploading, setUploading] = useState(false);
  const [declining, setDeclining] = useState(false);

  const report = async () => {
    const completedQty = amount.trim() === '' ? Number.NaN : Number(amount);
    if (!Number.isInteger(completedQty) || completedQty < 0 || completedQty > allocation.quantity) {
      setProblem('invalidQty');
      return;
    }
    setProblem(null);
    let photoMediaId: string | undefined;
    if (photo) {
      setUploading(true);
      try {
        photoMediaId = await uploadPhoto(client, photo);
      } catch {
        setProblem('photoFailed');
        return;
      } finally {
        setUploading(false);
      }
    }
    await run(
      () =>
        client.reportProgress(allocation.id, allocation.version, {
          completedQty,
          ...(note.trim() ? { note: note.trim() } : {}),
          ...(photoMediaId ? { photoMediaId } : {}),
        }),
      t('reportedToast'),
    );
    setNote('');
    setPhoto(null);
    setAmount('');
  };

  return (
    <Card className="flex flex-col gap-3 p-4" data-testid="allocation-card">
      {children}
      <p className="tabular-nums">
        {format.number(allocation.completedQty)} / {format.number(allocation.quantity)}
        {unit ? ` ${unit}` : ''}
      </p>
      <p>{t(`status.${allocation.status}`)}</p>
      {allocation.status === 'PROPOSED' ? (
        <div className="flex gap-2">
          <Button
            disabled={busy}
            onClick={() =>
              void run(
                () => client.confirmAllocation(allocation.id, allocation.version),
                t('confirmedToast'),
              )
            }
          >
            {t('confirm')}
          </Button>
          <Button variant="secondary" disabled={busy} onClick={() => setDeclining(true)}>
            {t('decline')}
          </Button>
        </div>
      ) : null}
      {allocation.status === 'IN_PROGRESS' ? (
        <form
          className="flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            void report();
          }}
        >
          <label className="flex flex-col gap-1 text-small">
            {t('completedQty')}
            <input
              className="h-10 max-w-40 rounded-input border border-ink/20 bg-paper px-2 text-right tabular-nums"
              inputMode="numeric"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1 text-small">
            {t('note')}
            <textarea
              rows={2}
              maxLength={500}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              className="rounded-input border border-ink/20 bg-paper p-2"
            />
          </label>
          <label className="flex flex-col gap-1 text-small">
            {t('photo')}
            <input
              type="file"
              accept="image/*"
              onChange={(event) => setPhoto(event.target.files?.[0] ?? null)}
            />
          </label>
          {problem ? (
            <p role="alert" className="text-small text-seal">
              {problem === 'invalidQty'
                ? t('invalidQty', { max: allocation.quantity })
                : t('photoFailed')}
            </p>
          ) : null}
          <Button type="submit" className="self-start" disabled={busy || uploading}>
            {uploading ? t('uploading') : t('report')}
          </Button>
        </form>
      ) : null}
      {allocation.progressLog.length > 0 ? (
        <section className="flex flex-col gap-2 border-ink/10 border-t pt-3">
          <h3 className="text-small font-medium">{t('history')}</h3>
          <ul className="flex flex-col gap-3 text-small">
            {[...allocation.progressLog].reverse().map((entry) => (
              <li key={entry.at} className="flex flex-col gap-1">
                <p className="text-ash">
                  <time dateTime={entry.at}>
                    {format.dateTime(new Date(entry.at), {
                      dateStyle: 'short',
                      timeStyle: 'short',
                    })}
                  </time>{' '}
                  · {format.number(entry.completedQty)} / {format.number(allocation.quantity)}
                </p>
                {entry.note ? <p className="break-words">{entry.note}</p> : null}
                {entry.photoUrl ? (
                  // biome-ignore lint/performance/noImgElement: household photos come from storage hosts that vary by deployment.
                  <img
                    src={entry.photoUrl}
                    alt={t('photoAlt', {
                      date: format.dateTime(new Date(entry.at), 'short'),
                    })}
                    loading="lazy"
                    className="max-h-48 w-auto rounded-input object-contain"
                  />
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <ConfirmDialog
        open={declining}
        tone="seal"
        title={t('declineTitle')}
        confirmLabel={t('decline')}
        cancelLabel={t('cancel')}
        onClose={() => setDeclining(false)}
        onConfirm={() => {
          setDeclining(false);
          void run(
            () => client.declineAllocation(allocation.id, allocation.version),
            t('declinedToast'),
          );
        }}
      >
        <p className="text-ash">{t('declineText')}</p>
      </ConfirmDialog>
    </Card>
  );
}
