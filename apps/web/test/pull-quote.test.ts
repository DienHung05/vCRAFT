import { describe, expect, it } from 'vitest';
import { pullQuote } from '@/features/exhibition/pull-quote';

describe('pullQuote', () => {
  it('takes the first sentence and drops its closing full stop', () => {
    expect(
      pullQuote('Every vase is turned by hand and fired twice in the old kiln. The rest follows.'),
    ).toBe('Every vase is turned by hand and fired twice in the old kiln');
  });

  it('returns null for a sentence that is too short or too long to quote', () => {
    expect(pullQuote('Short one. And more text here that goes on.')).toBeNull();
    expect(pullQuote(`${'word '.repeat(60)}end.`)).toBeNull();
  });

  it('keeps a question mark', () => {
    expect(pullQuote('Who keeps the fire burning through the long wet winter months?')).toBe(
      'Who keeps the fire burning through the long wet winter months?',
    );
  });
});
