import type { ObjectStorage } from '@vcraft/storage';
import { renderLabelSheet } from './render-label-sheet';

/** Payload of the `qr.labels` job, from the `qr.labels.requested` outbox event. */
export interface QrLabelsJob {
  requestId: string;
  householdId: string;
  codes: string[];
}

/** Where the finished sheet is stored; the API presigns the same key for the download. */
export function qrLabelsKey(householdId: string, requestId: string): string {
  return `qr-labels/${householdId}/${requestId}.pdf`;
}

/**
 * Renders the requested labels and stores the PDF in the private bucket. Writing the same key again on
 * a retry is harmless, so the job is idempotent.
 */
export async function generateQrLabels(
  deps: { storage: ObjectStorage; origin: string },
  job: QrLabelsJob,
): Promise<void> {
  const body = await renderLabelSheet({ codes: job.codes, origin: deps.origin });
  await deps.storage.put({
    bucket: 'private',
    key: qrLabelsKey(job.householdId, job.requestId),
    body,
    contentType: 'application/pdf',
  });
}
