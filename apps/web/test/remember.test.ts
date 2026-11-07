import { afterEach, describe, expect, it } from 'vitest';
import {
  clearRememberPreference,
  REMEMBER_COOKIE,
  readRememberPreference,
  setRememberPreference,
  withRememberPolicy,
} from '@/lib/auth/remember';

const persistent = { path: '/', sameSite: 'lax' as const, httpOnly: false, maxAge: 34_560_000 };

describe('withRememberPolicy', () => {
  it('keeps the options untouched when the visitor chose to be remembered', () => {
    expect(withRememberPolicy(persistent, true)).toEqual(persistent);
  });

  it('drops maxAge and expires, and keeps every other attribute, when not remembered', () => {
    const result = withRememberPolicy(
      { ...persistent, expires: new Date(Date.now() + 86_400_000) },
      false,
    );
    expect(result).toEqual({ path: '/', sameSite: 'lax', httpOnly: false });
    expect(result).not.toHaveProperty('maxAge');
    expect(result).not.toHaveProperty('expires');
  });

  it('leaves a deletion write alone so sign-out still removes the cookie', () => {
    const byMaxAge = { ...persistent, maxAge: 0 };
    expect(withRememberPolicy(byMaxAge, false)).toEqual(byMaxAge);
    const byExpires = { path: '/', expires: new Date(0) };
    expect(withRememberPolicy(byExpires, false)).toEqual(byExpires);
  });

  it('passes missing options through', () => {
    expect(withRememberPolicy(undefined, false)).toBeUndefined();
  });
});

describe('readRememberPreference', () => {
  it('remembers by default, including when the cookie list is empty', () => {
    expect(readRememberPreference([])).toBe(true);
    expect(readRememberPreference([{ name: 'sb-x-auth-token', value: 'a' }])).toBe(true);
  });

  it('forgets only when the marker is 0', () => {
    expect(readRememberPreference([{ name: REMEMBER_COOKIE, value: '0' }])).toBe(false);
    expect(readRememberPreference([{ name: REMEMBER_COOKIE, value: '' }])).toBe(true);
    expect(readRememberPreference([{ name: REMEMBER_COOKIE, value: '1' }])).toBe(true);
  });
});

describe('remember marker in the browser', () => {
  afterEach(() => clearRememberPreference());

  it('writes the session marker when not remembered and removes it when remembered', () => {
    setRememberPreference(false);
    expect(document.cookie).toContain(`${REMEMBER_COOKIE}=0`);
    setRememberPreference(true);
    expect(document.cookie).not.toContain(REMEMBER_COOKIE);
  });

  it('clearRememberPreference removes the marker', () => {
    setRememberPreference(false);
    clearRememberPreference();
    expect(document.cookie).not.toContain(REMEMBER_COOKIE);
  });
});
