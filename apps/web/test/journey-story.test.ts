import { messages } from '@vcraft/i18n';
import { createTranslator } from 'next-intl';
import { describe, expect, it } from 'vitest';
import {
  composeJourneyStory,
  type StoryEntry,
  type StoryInput,
} from '@/features/traceability/journey-story';

const STAGES = ['clay', 'throw', 'dry', 'paint', 'glaze', 'fire', 'finish'] as const;
const FORBIDDEN = /(?<![\p{L}])(băm|sha|hash|hashes|chuỗi)(?![\p{L}])/iu;

function translator(locale: 'vi' | 'en') {
  const t = createTranslator({ locale, messages: messages[locale], namespace: 'trace.story' });
  return (key: string, values?: Record<string, string | number>) =>
    t(key as never, values as never);
}

function entry(seq: number, stage: StoryEntry['stage'], at: string, rest = {}): StoryEntry {
  return { seq, stage, at, note: `Ghi chú ${stage}`, ...rest };
}

function input(entries: StoryEntry[], seed = 'AB23CD45'): StoryInput {
  return {
    entries,
    productName: 'Bình hút lộc',
    household: 'Gốm Minh Hải',
    seed,
    formatDate: (at) => `ngày ${at}`,
  };
}

const full = STAGES.map((stage, i) => entry(i, stage, `2026-03-${String(i + 1).padStart(2, '0')}`));

describe('composeJourneyStory', () => {
  it('writes one chapter per entry, oldest first, with the note untouched', () => {
    const story = composeJourneyStory(input(full), translator('vi'));
    expect(story.chapters.map((c) => c.stage)).toEqual([...STAGES]);
    expect(story.chapters[2]?.note).toBe('Ghi chú dry');
    expect(story.chapters[0]?.date).toBe('ngày 2026-03-01');
    expect(story.prologue).toContain('Bình hút lộc');
  });

  it('is deterministic for a seed and differs across seeds', () => {
    const t = translator('vi');
    const a = composeJourneyStory(input(full, 'AB23CD45'), t);
    expect(composeJourneyStory(input(full, 'AB23CD45'), t)).toEqual(a);
    const seeds = ['AB23CD45', 'BT7K2QXM', 'LN4R8TPA', 'ZZ9Y8X7W', 'QQ1W2E3R', 'MM5N6B7V'];
    const bodies = new Set(
      seeds.map((s) => composeJourneyStory(input(full, s), t).chapters[0]?.body),
    );
    expect(bodies.size).toBeGreaterThan(1);
  });

  it('opens each chapter after the first with the time gap since the previous entry', () => {
    const t = translator('vi');
    const story = composeJourneyStory(
      input([
        entry(0, 'clay', '2026-03-01'),
        entry(1, 'throw', '2026-03-01'),
        entry(2, 'dry', '2026-03-02'),
        entry(3, 'paint', '2026-03-05'),
        entry(4, 'glaze', '2026-03-26'),
        entry(5, 'fire', '2026-04-02'),
        entry(6, 'finish', '2026-08-01'),
      ]),
      t,
    );
    const [c0, c1, c2, c3, c4, c5, c6] = story.chapters;
    expect(c0?.gap).toBeUndefined();
    for (const c of story.chapters) expect(c.body).not.toMatch(/ngày sau|tuần sau|Hôm sau/);
    expect(c1?.gap).toBe('Cùng ngày');
    expect(c2?.gap).toBe('Hôm sau');
    expect(c3?.gap).toBe('3 ngày sau');
    expect(c4?.gap).toBe('3 tuần sau');
    expect(c5?.gap).toBe('7 ngày sau');
    expect(c6?.gap).toBe('Khoảng 4 tháng sau');
  });

  it('says "nearly n weeks" when the gap is not a whole number of weeks', () => {
    const story = composeJourneyStory(
      input([entry(0, 'clay', '2026-03-01'), entry(1, 'throw', '2026-03-20')]),
      translator('vi'),
    );
    expect(story.chapters[1]?.gap).toBe('Gần 3 tuần sau');
  });

  it('ends differently when the journal has no finish entry', () => {
    const t = translator('vi');
    const open = composeJourneyStory(input(full.slice(0, 5)), t);
    const done = composeJourneyStory(input(full), t);
    expect(open.epilogue).toMatch(/vẫn đang được viết|chưa ra lò/);
    expect(done.epilogue).not.toMatch(/vẫn đang được viết|chưa ra lò/);
  });

  it('gives skipped and correcting entries their own sentence', () => {
    const t = translator('vi');
    const story = composeJourneyStory(
      input([
        entry(0, 'clay', '2026-03-01'),
        entry(1, 'paint', '2026-03-03', { skipReason: 'Bỏ phơi vì trời khô' }),
        entry(2, 'paint', '2026-03-04', { supersedesSeq: 1 }),
      ]),
      t,
    );
    expect(story.chapters[1]?.body).toMatch(/bỏ qua|không được thực hiện/);
    expect(story.chapters[1]?.body).not.toContain('Bỏ phơi vì trời khô');
    expect(story.chapters[2]?.body).toMatch(/mốc 2\./);
  });

  it('drops an empty note instead of quoting nothing', () => {
    const story = composeJourneyStory(
      input([entry(0, 'clay', '2026-03-01', { note: '  ' })]),
      translator('vi'),
    );
    expect(story.chapters[0]).not.toHaveProperty('note');
  });

  it.each(['vi', 'en'] as const)(
    'never uses internal jargon in %s story or trust copy',
    (locale) => {
      const tree = messages[locale].trace as unknown as Record<string, unknown>;
      const strings: string[] = [];
      const walk = (v: unknown) => {
        if (typeof v === 'string') strings.push(v);
        else if (v && typeof v === 'object') Object.values(v).forEach(walk);
      };
      walk(tree.story);
      walk(tree.integrity);
      walk(tree.timelineLead);
      expect(strings.length).toBeGreaterThan(60);
      for (const s of strings) expect(s, s).not.toMatch(FORBIDDEN);
    },
  );

  it('names no paint or glaze colour and uses the product name only where it lands', () => {
    for (const locale of ['vi', 'en'] as const) {
      const story = messages[locale].trace.story as unknown as Record<
        string,
        Record<string, string>
      >;
      for (const stage of STAGES) {
        for (const text of Object.values(story[stage] ?? {})) {
          expect(text, text).not.toMatch(/men lam|xanh|sắc lam|bóng mượt|blue|glossy/i);
          expect(text, text).not.toMatch(
            /(?<!của |xưởng )\{household\} (nhào|vẽ|tráng)|tay \{household\}/,
          );
          if (stage !== 'finish') expect(text, text).not.toContain('{product}');
        }
      }
    }
  });

  it('has three variants for every stage in both languages', () => {
    for (const locale of ['vi', 'en'] as const) {
      const story = messages[locale].trace.story as unknown as Record<
        string,
        Record<string, string>
      >;
      for (const stage of STAGES) expect(Object.keys(story[stage] ?? {})).toHaveLength(3);
    }
  });
});
