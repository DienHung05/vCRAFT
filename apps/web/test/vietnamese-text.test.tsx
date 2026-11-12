import { screen } from '@testing-library/react';
import { messages } from '@vcraft/i18n';
import { createFormatter, createTranslator } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';
import type { LogEntryView } from '@/features/catalog/view-models';
import { MakerCredits } from '@/features/exhibition/maker-credits';
import { FireTimeline } from '@/features/traceability/fire-timeline';
import { formats } from '@/i18n/formats';
import { fallbackLang, vietnameseOnlyLang } from '@/lib/vietnamese-text';
import { renderEn, renderVi } from './render';

vi.mock('next-intl/server', () => ({
  getTranslations: async (namespace: string) =>
    createTranslator({ locale: 'en', messages: messages.en, namespace: namespace as 'trace' }),
  getFormatter: async () =>
    createFormatter({ locale: 'en', formats, timeZone: 'Asia/Ho_Chi_Minh' }),
}));

describe('lang of Vietnamese text on English pages (GH#482)', () => {
  it('marks household-written text as Vietnamese on /en only', () => {
    expect(vietnameseOnlyLang('en')).toBe('vi');
    expect(vietnameseOnlyLang('vi')).toBeUndefined();
  });

  it('marks a Vietnamese fallback on /en only when the English text is missing', () => {
    expect(fallbackLang('en', null)).toBe('vi');
    expect(fallbackLang('en', undefined)).toBe('vi');
    expect(fallbackLang('en', '   ')).toBe('vi');
    expect(fallbackLang('en', 'Blue-Glazed Fortune Vase')).toBeUndefined();
    expect(fallbackLang('vi', null)).toBeUndefined();
  });
});

const entries: LogEntryView[] = [
  {
    seq: 0,
    stage: 'clay',
    at: '2026-03-01',
    note: 'Lọc đất sét sông Hồng, ủ ba tuần.',
    mediaChecksums: [],
    skipReason: 'Dùng đất ủ sẵn',
    prevHash: 'p'.repeat(64),
    hash: '0'.repeat(64),
    tint: '#8a5a3c',
    images: [],
  },
];

describe('journal notes on the trace page', () => {
  it('carry lang="vi" on /en, including the skip reason inside the English sentence', async () => {
    const { container } = renderEn(await FireTimeline({ entries, locale: 'en' }));
    expect(screen.getByText('Lọc đất sét sông Hồng, ủ ba tuần.').getAttribute('lang')).toBe('vi');
    const reason = screen.getByText('Dùng đất ủ sẵn');
    expect(reason.getAttribute('lang')).toBe('vi');
    expect(reason.parentElement?.textContent).toMatch(/^Skipped earlier stages: /);
    expect(container.querySelectorAll('[lang="vi"]')).toHaveLength(2);
  });

  it('carry no lang attribute on /vi', async () => {
    const { container } = renderVi(await FireTimeline({ entries, locale: 'vi' }));
    expect(container.querySelector('[lang]')).toBeNull();
  });
});

describe('maker credits', () => {
  const makers = [{ name: 'Đỗ Văn Bình', detail: 'Vuốt dáng' }];

  it('mark the contribution, not the name, as Vietnamese on /en', () => {
    renderEn(<MakerCredits household="Lò Đức Phát" makers={makers} />);
    expect(screen.getByText('Vuốt dáng').getAttribute('lang')).toBe('vi');
    expect(screen.getByText('Đỗ Văn Bình').hasAttribute('lang')).toBe(false);
  });

  it('carry no lang attribute on /vi', () => {
    renderVi(<MakerCredits household="Lò Đức Phát" makers={makers} />);
    expect(screen.getByText('Vuốt dáng').hasAttribute('lang')).toBe(false);
  });
});
