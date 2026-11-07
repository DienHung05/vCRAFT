import { describe, expect, it } from 'vitest';
import {
  isReservedUsername,
  isValidUsername,
  normalizeUsername,
  RESERVED_USERNAMES,
} from '../src/account/username.js';

/**
 * GH#212 — username rules: normalize to lowercase before validating, 3-30 characters from
 * `a-z 0-9 . _ -`. One schema serves both the web (sign-up) and the API (rename), so the two
 * layers cannot drift apart.
 */
describe('Username rules', () => {
  it('accepts a valid name and returns the lowercased form', () => {
    expect(normalizeUsername('  An.Nguyen  ')).toBe('an.nguyen');
    expect(normalizeUsername('Lo-Duc_Phat01')).toBe('lo-duc_phat01');
    expect(normalizeUsername('a.b_c-d0')).toBe('a.b_c-d0');
  });

  it('rewrites uppercase to lowercase, so both spellings are one account', () => {
    expect(normalizeUsername('ADMIN')).toBe('admin');
    expect(normalizeUsername('  BUYER ')).toBe('buyer');
  });

  it('rejects names that are too short, too long, or contain other characters', () => {
    expect(isValidUsername('ab')).toBe(false);
    expect(isValidUsername('a'.repeat(31))).toBe(false);
    expect(isValidUsername('with accents é')).toBe(false);
    expect(isValidUsername('space inside')).toBe(false);
    expect(isValidUsername('an@nguyen')).toBe(false);
    expect(isValidUsername('')).toBe(false);
  });

  it('accepts the boundary lengths 3 and 30', () => {
    expect(isValidUsername('abc')).toBe(true);
    expect(isValidUsername('a'.repeat(30))).toBe(true);
  });
});

describe('isReservedUsername', () => {
  it('reserves the words of system and demo accounts', () => {
    expect(RESERVED_USERNAMES).toEqual(
      expect.arrayContaining(['admin', 'root', 'support', 'buyer', 'household', 'pending']),
    );
  });

  it('detects reserved words regardless of case and surrounding whitespace', () => {
    for (const name of RESERVED_USERNAMES) {
      expect(isReservedUsername(name)).toBe(true);
      expect(isReservedUsername(name.toUpperCase())).toBe(true);
      expect(isReservedUsername(`  ${name} `)).toBe(true);
    }
  });

  it('does not forbid ordinary names', () => {
    expect(isReservedUsername('an.nguyen')).toBe(false);
    expect(isReservedUsername('lo-duc_phat')).toBe(false);
    expect(isReservedUsername('administrator')).toBe(false);
    expect(isReservedUsername('household.nguyen')).toBe(false);
  });

  it('normalizes the sign-in spelling', () => {
    expect(normalizeUsername('  An.Nguyen ')).toBe('an.nguyen');
  });
});
