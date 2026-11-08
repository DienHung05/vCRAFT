import { describe, expect, it } from 'vitest';
import { PublicCreditSchema, publicCredit } from '../src/media';

const credit = {
  title: 'Bình men lam',
  author: 'Nguyễn Văn A',
  license: 'CC BY-SA 4.0',
  licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
  sourceUrl: 'https://commons.wikimedia.org/wiki/File:Example.jpg',
};

describe('public credit (GH#230)', () => {
  it('keeps a credit with real licence and source links', () => {
    expect(PublicCreditSchema.parse(credit)).toEqual(credit);
    expect(publicCredit(credit)).toBe(credit);
  });

  it('reads a credit with an unknown licence (empty URLs) as no credit instead of failing', () => {
    const unknown = { ...credit, author: 'unknown', license: 'unknown', licenseUrl: '' };
    expect(PublicCreditSchema.parse(unknown)).toBeNull();
    expect(publicCredit(unknown)).toBeNull();
    expect(publicCredit({ ...credit, sourceUrl: '' })).toBeNull();
  });

  it('passes null and missing credits through as null', () => {
    expect(PublicCreditSchema.parse(null)).toBeNull();
    expect(publicCredit(undefined)).toBeNull();
  });
});
