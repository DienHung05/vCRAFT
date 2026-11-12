import { JOURNAL_STAGES } from '@vcraft/domain';
import { describe, expect, it } from 'vitest';
import { DEMO_QR_TRACE_CODE } from '../src/seeders/demo/accounts.js';
import {
  JOURNAL_PHOTO_EXTRA_TRACE_CODES,
  JOURNAL_PHOTO_IDS,
  JOURNAL_STAGE_PHOTOS,
  journalPhotoIds,
} from '../src/seeders/demo/journal-photos.js';
import { DEMO_PHOTOS, RETIRED_DEMO_PHOTO_IDS } from '../src/seeders/demo/photo-manifest.js';

describe('stage photos of the demo journals (GH#472)', () => {
  const photos = new Map(DEMO_PHOTOS.map((p) => [p.id, p]));

  it('has at least one photo for every stage, and each is a real photo of the manifest', () => {
    for (const stage of JOURNAL_STAGES) {
      expect(JOURNAL_STAGE_PHOTOS[stage].length, stage).toBeGreaterThanOrEqual(1);
    }
    for (const id of JOURNAL_PHOTO_IDS) {
      expect(photos.has(id), id).toBe(true);
      expect(RETIRED_DEMO_PHOTO_IDS.includes(id), id).toBe(false);
      // Only photos with an author, an open licence and a source page: the trace page prints them under the photo.
      const credit = photos.get(id)?.credit;
      expect(credit?.author.trim(), id).toBeTruthy();
      expect(credit?.license, id).toMatch(/^(CC0|CC BY|CC BY-SA|Public domain)/i);
      expect(credit?.sourceUrl, id).toMatch(/^https:\/\/commons\.wikimedia\.org\//);
    }
  });

  it('gives every milestone one to three photos, the same ones on every call', () => {
    for (const code of [DEMO_QR_TRACE_CODE, ...JOURNAL_PHOTO_EXTRA_TRACE_CODES, 'ABCDEFGH']) {
      for (const stage of JOURNAL_STAGES) {
        const ids = journalPhotoIds(code, stage);
        expect(ids.length, `${code} ${stage}`).toBeGreaterThanOrEqual(1);
        expect(ids.length, `${code} ${stage}`).toBeLessThanOrEqual(3);
        expect(new Set(ids).size, `${code} ${stage}`).toBe(ids.length);
        for (const id of ids) expect(JOURNAL_STAGE_PHOTOS[stage]).toContain(id);
        expect(journalPhotoIds(code, stage)).toEqual(ids);
      }
    }
  });

  it('shows the QR cup two photos at every stage that has two, other pieces one', () => {
    for (const stage of JOURNAL_STAGES) {
      expect(journalPhotoIds(DEMO_QR_TRACE_CODE, stage)).toHaveLength(
        Math.min(2, JOURNAL_STAGE_PHOTOS[stage].length),
      );
      expect(journalPhotoIds('BT7K2QXM', stage)).toHaveLength(1);
    }
  });

  it('does not show every piece the same photo at a stage', () => {
    const codes = ['BT7K2QXM', 'HX2M9KQD', 'ABCDEFGH', 'JKMNPQRS', 'TUVWXYZ2'];
    const seen = new Set(codes.map((code) => journalPhotoIds(code, 'glaze')[0]));
    expect(seen.size).toBeGreaterThan(1);
  });
});
