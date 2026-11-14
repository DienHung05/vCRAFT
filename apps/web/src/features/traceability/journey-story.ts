import { isJournalInProgress, type JournalStage } from '@vcraft/domain';

/** A message lookup under `trace.story`; the page passes the real translator, tests pass their own. */
export type StoryTranslator = (key: string, values?: Record<string, string | number>) => string;

export interface StoryEntry {
  seq: number;
  stage: JournalStage;
  /** The declared date, ISO (`2026-06-09`, or a full timestamp). */
  at: string;
  note: string;
  skipReason?: string | undefined;
  supersedesSeq?: number | undefined;
}

export interface StoryInput {
  entries: readonly StoryEntry[];
  productName: string;
  household: string;
  /** Stable per product (the trace code): one piece always reads the same. */
  seed: string;
  formatDate: (at: string) => string;
}

export interface StoryChapter {
  seq: number;
  stage: JournalStage;
  title: string;
  /** Formatted declared date. */
  date: string;
  /** How long after the previous entry ('Hôm sau', '3 tuần sau'); absent for the first entry. */
  gap?: string;
  body: string;
  /** The maker's own words, never rewritten. */
  note?: string;
}

export interface JourneyStory {
  prologue: string;
  chapters: StoryChapter[];
  epilogue: string;
}

const VARIANTS = 3;

/** FNV-1a: a small stable hash, so the same seed always picks the same variant. */
function hash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

const pick = (seed: string, salt: string, count: number) => hash(`${seed}|${salt}`) % count;

const dayNumber = (at: string) => {
  const [y, m, d] = at.slice(0, 10).split('-').map(Number);
  return Math.floor(Date.UTC(y ?? 0, (m ?? 1) - 1, d ?? 1) / 86_400_000);
};

/** The time-gap opener between two entries, or undefined when the dates run backwards. */
function gapOpener(previous: string, current: string, t: StoryTranslator): string | undefined {
  const days = dayNumber(current) - dayNumber(previous);
  if (Number.isNaN(days) || days < 0) return undefined;
  if (days === 0) return t('gap.same');
  if (days === 1) return t('gap.next');
  if (days < 14) return t('gap.days', { n: days });
  if (days < 56) {
    const exact = days % 7 === 0;
    return t(exact ? 'gap.weeksExact' : 'gap.weeksNear', {
      n: exact ? days / 7 : Math.ceil(days / 7),
    });
  }
  return t('gap.months', { n: Math.round(days / 30) });
}

/**
 * Writes the story of a piece from its journal (no model, no network): fixed, hand-written sentences chosen by
 * a hash of the seed, filled only with facts that are in the record (product, household, declared dates, which
 * entry corrects which). The maker's note is passed through untouched so it can be quoted.
 */
export function composeJourneyStory(input: StoryInput, t: StoryTranslator): JourneyStory {
  const { entries, productName: product, household, seed, formatDate } = input;
  const base = { product, household };
  const chapters = entries.map((entry, index): StoryChapter => {
    const date = formatDate(entry.at);
    const previous = entries[index - 1];
    const parts: string[] = [];
    const gap = previous ? gapOpener(previous.at, entry.at, t) : undefined;
    if (entry.supersedesSeq !== undefined) {
      parts.push(
        t(`correction.${pick(seed, `correction${entry.seq}`, 2)}`, {
          ...base,
          n: entry.supersedesSeq + 1,
        }),
      );
    }
    parts.push(
      t(`${entry.stage}.${pick(seed, entry.stage, VARIANTS)}`, { ...base, date, n: entry.seq + 1 }),
    );
    if (entry.skipReason) parts.push(t(`skip.${pick(seed, `skip${entry.seq}`, 2)}`, base));
    const note = entry.note.trim();
    return {
      seq: entry.seq,
      stage: entry.stage,
      title: t(`title.${entry.stage}`),
      date,
      ...(gap ? { gap } : {}),
      body: parts.join(' '),
      ...(note ? { note: entry.note } : {}),
    };
  });
  const finished = entries.length > 0 && !isJournalInProgress(entries);
  return {
    prologue: t(`prologue.${pick(seed, 'prologue', VARIANTS)}`, base),
    chapters,
    epilogue: t(`${finished ? 'epilogue' : 'epilogueOpen'}.${pick(seed, 'epilogue', 2)}`, {
      ...base,
      count: entries.length,
    }),
  };
}
