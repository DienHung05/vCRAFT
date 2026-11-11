import { messages } from '@vcraft/i18n';
import { createFormatter, createTranslator } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';
import type { LogEntryView } from '@/features/catalog/view-models';
import { FireTimeline } from '@/features/traceability/fire-timeline';
import { formats } from '@/i18n/formats';
import { renderVi } from './render';

vi.mock('next-intl/server', () => ({
  getTranslations: async (namespace: string) =>
    createTranslator({ locale: 'vi', messages: messages.vi, namespace: namespace as 'trace' }),
  getFormatter: async () =>
    createFormatter({ locale: 'vi', formats, timeZone: 'Asia/Ho_Chi_Minh' }),
}));

function entry(seq: number, stage: LogEntryView['stage'], at: string): LogEntryView {
  return {
    seq,
    stage,
    at,
    note: `Ghi chú ${stage}`,
    mediaChecksums: [],
    prevHash: 'p'.repeat(64),
    hash: `${seq}`.repeat(64),
    tint: '#8a5a3c',
    images: [],
  };
}

describe('FireTimeline milestone dates (GH#476)', () => {
  it('shows a date-only declared date as day, month and year, with no invented time', async () => {
    const ui = await FireTimeline({
      entries: [entry(0, 'clay', '2026-06-09'), entry(1, 'throw', '2026-06-10')],
    });
    const { container } = renderVi(ui);
    const times = Array.from(container.querySelectorAll('time'));
    expect(times.map((t) => t.getAttribute('datetime'))).toEqual(['2026-06-09', '2026-06-10']);
    expect(times.map((t) => t.textContent)).toEqual(['9 tháng 6, 2026', '10 tháng 6, 2026']);
    expect(container.textContent).not.toMatch(/07:00|00:00/);
  });
});
