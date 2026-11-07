import { describe, expect, it } from 'vitest';
import { CreateJournalEntryRequestSchema, UpdateJournalEntryRequestSchema } from '../src/journal';

const image = (n: number) => ({
  url: `https://cdn.test/journal/${n}.webp`,
  sha256: n.toString(16).padStart(64, '0'),
});

const entry = (count: number) => ({
  stage: 'finish',
  declaredDate: '2026-01-10',
  note: 'Đã tráng men xong.',
  images: Array.from({ length: count }, (_, i) => image(i + 1)),
});

describe('journal entry photos (FR-PRD-04)', () => {
  it('refuses a milestone without a photo', () => {
    const result = CreateJournalEntryRequestSchema.safeParse(entry(0));
    expect(result.success).toBe(false);
    expect(UpdateJournalEntryRequestSchema.safeParse(entry(0)).success).toBe(false);
    expect(
      CreateJournalEntryRequestSchema.safeParse({ ...entry(1), images: undefined }).success,
    ).toBe(false);
  });

  it('refuses a milestone with more than 6 photos', () => {
    expect(CreateJournalEntryRequestSchema.safeParse(entry(7)).success).toBe(false);
    expect(UpdateJournalEntryRequestSchema.safeParse(entry(7)).success).toBe(false);
  });

  it('accepts between 1 and 6 photos', () => {
    for (const count of [1, 3, 6]) {
      expect(CreateJournalEntryRequestSchema.safeParse(entry(count)).success).toBe(true);
      expect(UpdateJournalEntryRequestSchema.safeParse(entry(count)).success).toBe(true);
    }
  });
});
