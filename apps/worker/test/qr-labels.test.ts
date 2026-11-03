import { PDFDocument } from 'pdf-lib';
import { describe, expect, it, vi } from 'vitest';
import { createOutboxDispatcher } from '../src/processors/outbox/dispatch';
import { generateQrLabels, qrLabelsKey } from '../src/processors/qr-labels/generate-qr-labels';
import {
  LABELS_PER_PAGE,
  labelUrl,
  renderLabelSheet,
} from '../src/processors/qr-labels/render-label-sheet';

const codes = (n: number) =>
  Array.from({ length: n }, (_, i) => `ABCD${String(i).padStart(4, '2')}`);

describe('renderLabelSheet', () => {
  it('lays out 45 labels per A4 page', async () => {
    const pdf = await PDFDocument.load(
      await renderLabelSheet({ codes: codes(LABELS_PER_PAGE + 1), origin: 'https://vcraft.vn' }),
    );
    expect(pdf.getPageCount()).toBe(2);
    const [width, height] = [pdf.getPage(0).getWidth(), pdf.getPage(0).getHeight()];
    // A4 in points.
    expect(Math.round(width)).toBe(595);
    expect(Math.round(height)).toBe(842);
    expect(pdf.getTitle()).toBe('vCraft QR labels');
  });

  it('refuses an empty sheet', async () => {
    await expect(renderLabelSheet({ codes: [], origin: 'https://vcraft.vn' })).rejects.toThrow();
  });

  it('encodes the public short URL', () => {
    expect(labelUrl('https://vcraft.vn/', 'AB23CD45')).toBe('https://vcraft.vn/q/AB23CD45');
  });
});

describe('qr.labels job', () => {
  it('stores the PDF in the private bucket under the request key', async () => {
    const put = vi.fn(async () => undefined);
    await generateQrLabels(
      { storage: { put } as never, origin: 'https://vcraft.vn' },
      { requestId: 'r1', householdId: 'h1', codes: ['AB23CD45'] },
    );
    expect(put).toHaveBeenCalledWith(
      expect.objectContaining({
        bucket: 'private',
        key: qrLabelsKey('h1', 'r1'),
        contentType: 'application/pdf',
      }),
    );
  });

  it('is routed from the outbox with a request-scoped job id', async () => {
    const sink = () => ({ add: vi.fn(async () => undefined) });
    const queues = { media: sink(), mail: sink(), qrLabels: sink(), scheduler: sink() };
    const payload = { requestId: 'r1', householdId: 'h1', codes: ['AB23CD45'] };
    await createOutboxDispatcher(queues)({ id: 'e1', type: 'qr.labels.requested', payload });
    expect(queues.qrLabels.add).toHaveBeenCalledWith('qr.labels', payload, {
      jobId: 'qr-labels-r1',
    });
  });
});

describe('rfq.submitted', () => {
  it('schedules rfq.expire at the bidding deadline, keyed by request and deadline', async () => {
    const sink = () => ({ add: vi.fn(async () => undefined) });
    const queues = { media: sink(), mail: sink(), qrLabels: sink(), scheduler: sink() };
    const closesAt = '2026-11-10T10:00:00.000Z';
    const now = Date.parse(closesAt) - 60_000;
    await createOutboxDispatcher(
      queues,
      () => now,
    )({
      id: 'e2',
      type: 'rfq.submitted',
      payload: { requestId: 'r9', biddingClosesAt: closesAt },
    });
    expect(queues.scheduler.add).toHaveBeenCalledWith(
      'rfq.expire',
      { requestId: 'r9' },
      { jobId: `rfq-expire-r9-${Date.parse(closesAt)}`, delay: 60_000 },
    );
  });
});
