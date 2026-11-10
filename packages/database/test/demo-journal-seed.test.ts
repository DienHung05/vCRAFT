import { createHash } from 'node:crypto';
import { JOURNAL_STAGES } from '@vcraft/domain';
import { describe, expect, it } from 'vitest';
import { FieldCipher } from '../src/crypto/field-cipher.js';
import { seedDemoData } from '../src/seeders/demo/seed-demo.js';

/** Runs the seed against a recording stand-in for the entity manager: no database is touched. */
async function seedRecorded() {
  const created: Array<{ cls: string; data: Record<string, unknown> }> = [];
  const em = {
    count: async () => 0,
    flush: async () => {},
    create: (cls: { name: string }, data: Record<string, unknown>) => {
      const entry = { ...data };
      created.push({ cls: cls.name, data: entry });
      return entry;
    },
  };
  await seedDemoData(em as never, {
    now: new Date('2026-11-01T00:00:00Z'),
    cipher: new FieldCipher(`v1:${Buffer.alloc(32, 7).toString('base64')}`),
  });
  const codes: string[] = [];
  const stagesByCode = new Map<string, string[]>();
  let skipReasons = 0;
  for (const { cls, data } of created) {
    if (cls === 'Product') codes.push(data.traceCode as string);
    if (cls === 'JournalEntry') {
      const code = (data.product as { traceCode: string }).traceCode;
      stagesByCode.set(code, [...(stagesByCode.get(code) ?? []), data.stage as string]);
      if (data.skipReason) skipReasons++;
    }
  }
  return { codes, stagesByCode, skipReasons };
}

describe('demo journals (GH#486)', () => {
  it('keeps every frozen trace code: the journal change draws the same random numbers as before', async () => {
    const { codes } = await seedRecorded();
    expect(codes).toHaveLength(222);
    expect(codes).toContain('DNENZF4C');
    // sha256 of the 222 codes in creation order, taken before journals stopped skipping stages.
    expect(createHash('sha256').update(codes.join(',')).digest('hex')).toBe(
      '30831fa9182499f8022d49b75b0cf765ba3ed65fab6f4afa4ba672857f4911f0',
    );
  });

  it('records all seven stages, except a gap-free unfinished prefix, and never a skip reason', async () => {
    const { stagesByCode, skipReasons } = await seedRecorded();
    expect(skipReasons).toBe(0);
    let unfinished = 0;
    for (const stages of stagesByCode.values()) {
      if (stages.includes('finish')) {
        expect(stages).toEqual([...JOURNAL_STAGES]);
      } else {
        unfinished++;
        expect(stages).toEqual(JOURNAL_STAGES.slice(0, stages.length));
        expect(stages.length).toBeGreaterThanOrEqual(4);
      }
    }
    expect(unfinished).toBeGreaterThan(0);
    expect(stagesByCode.get('DNENZF4C')).toEqual([...JOURNAL_STAGES]);
  });
});
