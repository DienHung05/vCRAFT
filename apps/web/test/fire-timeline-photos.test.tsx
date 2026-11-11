import { messages } from '@vcraft/i18n';
import { createFormatter, createTranslator } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';
import type { LogEntryView } from '@/features/catalog/view-models';
import { FireTimeline } from '@/features/traceability/fire-timeline';
import { formats } from '@/i18n/formats';
import { renderEn, renderVi } from './render';

let locale: 'vi' | 'en' = 'vi';
vi.mock('next-intl/server', () => ({
  getTranslations: async (namespace: string) =>
    createTranslator({ locale, messages: messages[locale], namespace: namespace as 'trace' }),
  getFormatter: async () => createFormatter({ locale, formats, timeZone: 'Asia/Ho_Chi_Minh' }),
}));

const CREDIT = {
  title: 'File:Bat-Trang-Ceramic-Village11.jpg',
  author: 'Steven C. Price',
  license: 'CC BY-SA 4.0',
  licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
  sourceUrl: 'https://commons.wikimedia.org/wiki/File:Bat-Trang-Ceramic-Village11.jpg',
};

function entry(seq: number, stage: LogEntryView['stage'], credit: typeof CREDIT | null) {
  return {
    seq,
    stage,
    at: `2026-03-0${seq + 1}`,
    note: `Ghi chú ${stage}`,
    mediaChecksums: [],
    prevHash: 'p'.repeat(64),
    hash: `${seq}`.repeat(64),
    tint: '#8a5a3c',
    images: [
      {
        url: `https://example.test/${seq}.webp`,
        sha256: `${seq}`.repeat(64),
        credit,
        variants: [],
        alt: credit ? 'Hai bàn tay gọt chân một chiếc bát trên bàn xoay' : null,
        mediaId: null,
        status: 'READY',
        thumbhash: null,
      },
    ],
  } as unknown as LogEntryView;
}

const journal = [entry(0, 'clay', CREDIT), entry(1, 'throw', null)];

describe('photos on a journal entry (GH#472)', () => {
  it('labels a credited photo as a photo of the stage, names its source and describes what it shows', async () => {
    locale = 'vi';
    const { container } = renderVi(await FireTimeline({ entries: journal, locale: 'vi' }));
    const captions = container.querySelectorAll('[data-stage-photo-note]');
    expect(captions).toHaveLength(1);
    expect(captions[0]?.textContent).toContain('không phải ảnh của món đồ này');
    expect(captions[0]?.textContent).toContain('Steven C. Price');
    expect(
      captions[0]?.querySelector<HTMLAnchorElement>('a[href*="commons.wikimedia.org"]'),
    ).not.toBeNull();
    expect(
      captions[0]?.querySelector<HTMLAnchorElement>('a[href*="creativecommons.org"]')?.textContent,
    ).toBe('CC BY-SA 4.0');
    const imgs = [...container.querySelectorAll('img')];
    expect(imgs.map((i) => i.getAttribute('alt'))).toContain(
      'Hai bàn tay gọt chân một chiếc bát trên bàn xoay',
    );
  });

  it("shows no note under a household's own photo", async () => {
    locale = 'vi';
    const { container } = renderVi(
      await FireTimeline({ entries: [journal[1] as LogEntryView], locale: 'vi' }),
    );
    expect(container.querySelector('[data-stage-photo-note]')).toBeNull();
    expect(container.querySelector('img')?.getAttribute('alt')).toBe(
      messages.vi.trace.proofAlt.replace('{stage}', messages.vi.stages.throw.name),
    );
  });

  it('uses an English description on /en, not the Vietnamese one', async () => {
    locale = 'en';
    const { container } = renderEn(
      await FireTimeline({ entries: [journal[0] as LogEntryView], locale: 'en' }),
    );
    const alt = container.querySelector('img')?.getAttribute('alt') ?? '';
    expect(alt).toMatch(
      /^Photo of the Kneading step in a Bát Tràng pottery workshop, not of this piece/,
    );
    expect(container.querySelector('[data-stage-photo-note]')?.textContent).toContain(
      'not of this piece',
    );
  });
});
