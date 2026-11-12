import { describe, expect, it } from 'vitest';
import { missingApplicationParts } from '../src/index';

const complete = {
  history: 'Gốm ba đời.',
  craftCategory: 'CERAMICS',
  craft: null,
  artisanCount: 1,
};

describe('missingApplicationParts (GH#474)', () => {
  it('accepts a story, a craft and one artisan', () => {
    expect(missingApplicationParts(complete)).toEqual([]);
  });

  it('lists every part of an empty application', () => {
    expect(
      missingApplicationParts({ history: '', craftCategory: null, craft: null, artisanCount: 0 }),
    ).toEqual(['story', 'craft', 'artisans']);
  });

  it('treats a whitespace-only story as missing', () => {
    expect(missingApplicationParts({ ...complete, history: '  \n ' })).toEqual(['story']);
  });

  it('accepts the legacy craft text when there is no category', () => {
    expect(
      missingApplicationParts({ ...complete, craftCategory: null, craft: 'Gốm men lam' }),
    ).toEqual([]);
    expect(missingApplicationParts({ ...complete, craftCategory: null, craft: '  ' })).toEqual([
      'craft',
    ]);
  });

  it('needs at least one artisan', () => {
    expect(missingApplicationParts({ ...complete, artisanCount: 0 })).toEqual(['artisans']);
  });
});
