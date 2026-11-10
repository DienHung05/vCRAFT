import { act, fireEvent, screen, within } from '@testing-library/react';
import { messages } from '@vcraft/i18n';
import { createFormatter, createTranslator } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { LogEntryView } from '@/features/catalog/view-models';
import { focusedStep, heatProgress, recordedAt } from '@/features/traceability/fire-story-math';
import { trackFireStory } from '@/features/traceability/fire-story-scroll';
import { FireTimeline } from '@/features/traceability/fire-timeline';
import { PIECE_KINDS, pieceKindOf, pieceKindOfFigure } from '@/features/traceability/piece-shapes';
import { formats } from '@/i18n/formats';
import { renderVi } from './render';

// Reduced motion is the only thing faked from the UI package; everything else stays real.
let reduced = false;
vi.mock('@vcraft/ui', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@vcraft/ui')>()),
  useReducedMotion: () => reduced,
}));
vi.mock('next-intl/server', () => ({
  getTranslations: async (namespace: string) =>
    createTranslator({ locale: 'vi', messages: messages.vi, namespace: namespace as 'trace' }),
  getFormatter: async () =>
    createFormatter({ locale: 'vi', formats, timeZone: 'Asia/Ho_Chi_Minh' }),
}));
// The scroll logic is its own chunk; here it is a spy, so a test can tell whether it was ever loaded.
vi.mock('@/features/traceability/fire-story-scroll', () => ({
  trackFireStory: vi.fn(() => () => {}),
}));

const STAGES = ['clay', 'throw', 'dry', 'paint', 'fire'] as const;

function entry(seq: number, stage: LogEntryView['stage'], withPhoto = false): LogEntryView {
  return {
    seq,
    stage,
    at: `2026-03-0${seq + 1}T08:00:00.000Z`,
    note: `Ghi chú ${stage}`,
    mediaChecksums: [],
    prevHash: 'p'.repeat(64),
    hash: `${seq}`.repeat(64),
    tint: '#8a5a3c',
    images: withPhoto
      ? ([
          {
            url: 'https://example.test/anh.jpg',
            sha256: 'a'.repeat(64),
            credit: null,
            variants: [],
          },
        ] as unknown as LogEntryView['images'])
      : [],
  };
}

const journal = STAGES.map((stage, seq) => entry(seq, stage, seq === 1));

async function renderTimeline(width: number) {
  Object.defineProperty(window, 'innerWidth', { value: width, configurable: true, writable: true });
  const ui = await FireTimeline({
    entries: journal,
    household: 'Gốm Minh Hải',
    pieceKind: 'vase',
    glaze: '#3f5a8a',
  });
  return renderVi(ui);
}

const stepsOf = (container: HTMLElement) =>
  Array.from(container.querySelectorAll<HTMLElement>('[data-fire-step]'));

beforeEach(() => {
  reduced = false;
  vi.mocked(trackFireStory).mockClear();
  Element.prototype.scrollIntoView = vi.fn();
});

describe('the piece shape follows the product (GH#300)', () => {
  it('maps a placeholder kind to one of the six silhouettes', () => {
    expect(
      (['bowl', 'cup', 'vase', 'jar', 'plate', 'teaset', 'incense', 'generic'] as const).map(
        pieceKindOfFigure,
      ),
    ).toEqual(['bowl', 'cup', 'vase', 'jar', 'plate', 'other', 'jar', 'other']);
  });

  it('chooses from the name and then the category, like the placeholder figure', () => {
    expect(pieceKindOf('TABLEWARE', 'Bát chiết yêu men nâu')).toBe('bowl');
    expect(pieceKindOf('VASE', 'Bình hút lộc men lam')).toBe('vase');
    expect(pieceKindOf('TEA', 'Chén tống men lam')).toBe('cup');
    expect(pieceKindOf('TABLEWARE', 'Đĩa vẽ sen')).toBe('plate');
    expect(pieceKindOf('VASE', 'Bình ngâm rượu men rạn')).toBe('jar');
    expect(pieceKindOf('WORSHIP', 'Lư hương men ngọc')).toBe('jar');
    expect(pieceKindOf('TEA', 'Bộ ấm chén vẽ sen')).toBe('other');
    expect(pieceKindOf(undefined, 'Món lạ')).toBe('other');
    for (const kind of PIECE_KINDS) expect(PIECE_KINDS).toContain(kind);
  });
});

describe('story maths', () => {
  it('puts exactly one step in focus, the last one that reached the focus line', () => {
    expect(focusedStep([500, 900, 1300], 300)).toBe(0);
    expect(focusedStep([100, 500, 900], 600)).toBe(1);
    expect(focusedStep([-900, -400, -50], 300)).toBe(2);
    expect(focusedStep([], 300)).toBe(0);
  });

  it('heats the line from nothing to the whole list as the focus line passes it', () => {
    expect(heatProgress(500, 1000, 300)).toBe(0);
    expect(heatProgress(0, 1000, 250)).toBe(0.25);
    expect(heatProgress(-2000, 1000, 300)).toBe(1);
    expect(heatProgress(0, 0, 300)).toBe(0);
  });

  it('tells which stages the journal recorded and which it did not', () => {
    const at = recordedAt([...STAGES]);
    expect(at).toEqual({ clay: 0, throw: 1, dry: 2, paint: 3, glaze: -1, fire: 4, finish: -1 });
  });
});

describe('FireTimeline under reduced motion or on a narrow screen (GH#300)', () => {
  async function expectStaticFallback(container: HTMLElement) {
    // Every recorded step with its real data.
    expect(stepsOf(container)).toHaveLength(5);
    for (const stage of ['Nhào đất', 'Vuốt dáng', 'Phơi mộc', 'Vẽ lam', 'Nung lò']) {
      expect(screen.getByRole('heading', { name: stage, level: 3 })).toBeTruthy();
    }
    expect(screen.getByText('Ghi chú throw')).toBeTruthy();
    expect(screen.getAllByText('Do Gốm Minh Hải ghi lại')).toHaveLength(5);
    expect(container.querySelectorAll('time')).toHaveLength(5);
    expect(screen.getByAltText('Ảnh minh chứng công đoạn Vuốt dáng')).toBeTruthy();
    // The final illustration, no story: nothing sticky, no focus marks, no chips, no scroll code.
    expect(container.querySelector('.fire-figure')?.getAttribute('data-piece-stage')).toBe(
      'finish',
    );
    expect(container.querySelector('.piece svg')).toBeTruthy();
    expect(container.querySelector('[data-fire-story="on"]')).toBeNull();
    expect(container.querySelector('[aria-current]')).toBeNull();
    expect(screen.queryByRole('navigation')).toBeNull();
    await act(async () => {});
    expect(trackFireStory).not.toHaveBeenCalled();
  }

  it('shows the readable list and the final illustration with motion reduced', async () => {
    reduced = true;
    const { container } = await renderTimeline(1440);
    await expectStaticFallback(container);
    // The journal has no `finish` entry, so it reads as still being made; no stage is flagged as missing.
    expect(screen.getByText(/Đang làm · chưa ghi: Tráng men, Ra lò/)).toBeTruthy();
    expect(screen.queryByText(/Chưa ghi nhận/)).toBeNull();
  });

  it('shows the same under 1024 px even when motion is allowed', async () => {
    const { container } = await renderTimeline(390);
    await expectStaticFallback(container);
  });
});

describe('FireTimeline as a story on a wide screen with motion (GH#300)', () => {
  it('marks the first step as current and loads the scroll logic only now', async () => {
    const { container } = await renderTimeline(1440);
    await act(async () => {});
    expect(container.querySelector('[data-fire-story="on"]')).toBeTruthy();
    const steps = stepsOf(container);
    expect(steps[0]?.getAttribute('aria-current')).toBe('step');
    expect(container.querySelectorAll('[aria-current="step"]')).toHaveLength(1);
    expect(container.querySelector('.fire-figure')?.getAttribute('data-piece-stage')).toBe('clay');
    expect(trackFireStory).toHaveBeenCalledTimes(1);
  });

  it('moves aria-current and the drawing when focus enters another step', async () => {
    const { container } = await renderTimeline(1440);
    await act(async () => {});
    const steps = stepsOf(container);
    act(() => steps[3]?.focus());
    expect(steps[3]?.getAttribute('aria-current')).toBe('step');
    expect(steps[0]?.hasAttribute('aria-current')).toBe(false);
    expect(container.querySelectorAll('[aria-current="step"]')).toHaveLength(1);
    expect(container.querySelector('.fire-figure')?.getAttribute('data-piece-stage')).toBe('paint');
  });

  it('follows the step in focus reported by the scroll logic', async () => {
    const { container } = await renderTimeline(1440);
    await act(async () => {});
    const call = vi.mocked(trackFireStory).mock.calls[0]?.[0];
    expect(call?.steps).toHaveLength(5);
    act(() => call?.onFocus(4));
    expect(stepsOf(container)[4]?.getAttribute('aria-current')).toBe('step');
    expect(container.querySelector('.fire-figure')?.getAttribute('data-piece-stage')).toBe('fire');
  });

  it('reaches every recorded stage by keyboard and leaves the others out of the track', async () => {
    const { container } = await renderTimeline(1440);
    await act(async () => {});
    const track = screen.getByRole('navigation', { name: 'Các công đoạn của món gốm' });
    const buttons = within(track).getAllByRole('button');
    expect(buttons.map((b) => b.textContent)).toEqual([
      'Nhào đất',
      'Vuốt dáng',
      'Phơi mộc',
      'Vẽ lam',
      'Nung lò',
    ]);
    expect(within(track).queryByText(/Chưa ghi/)).toBeNull();
    expect(within(track).getAllByRole('listitem')).toHaveLength(5);
    expect(within(track).queryByRole('button', { name: /Tráng men|Ra lò/ })).toBeNull();
    fireEvent.click(buttons[2] as HTMLElement);
    const steps = stepsOf(container);
    expect(steps[2]?.getAttribute('aria-current')).toBe('step');
    expect(document.activeElement).toBe(steps[2]);
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
  });
});

describe('FireTimeline of a finished journal that has no entry for some stages (GH#486)', () => {
  const finished = (['throw', 'dry', 'paint', 'fire', 'finish'] as const).map((stage, seq) =>
    entry(seq, stage),
  );

  it('says nothing about the stages without an entry and shows no unfinished badge', async () => {
    Object.defineProperty(window, 'innerWidth', {
      value: 1440,
      configurable: true,
      writable: true,
    });
    const ui = await FireTimeline({
      entries: finished,
      household: 'Gốm Minh Hải',
      pieceKind: 'vase',
    });
    const { container } = renderVi(ui);
    await act(async () => {});
    expect(stepsOf(container)).toHaveLength(5);
    expect(container.textContent).not.toMatch(/Chưa ghi/i);
    expect(container.textContent).not.toMatch(/Đang làm/);
    const track = screen.getByRole('navigation', { name: 'Các công đoạn của món gốm' });
    expect(
      within(track)
        .getAllByRole('button')
        .map((b) => b.textContent),
    ).toEqual(['Vuốt dáng', 'Phơi mộc', 'Vẽ lam', 'Nung lò', 'Ra lò']);
    // The chip of a later stage still points at the right step now that the track skips Nhào đất.
    fireEvent.click(within(track).getByRole('button', { name: 'Nung lò' }));
    expect(stepsOf(container)[3]?.getAttribute('aria-current')).toBe('step');
  });
});
