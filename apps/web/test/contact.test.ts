import { afterEach, describe, expect, it, vi } from 'vitest';
import { formatPhone, siteContact } from '@/lib/contact';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('formatPhone', () => {
  it('groups a national number 4-3-3 and builds the international tel: link', () => {
    expect(formatPhone('0963316273')).toEqual({
      display: '0963 316 273',
      href: 'tel:+84963316273',
    });
  });

  it('accepts +84 and spaced input', () => {
    expect(formatPhone('+84 963 316 273')).toEqual(formatPhone('0963316273'));
    expect(formatPhone('84963316273')).toEqual(formatPhone('0963316273'));
  });

  it('shows an unrecognised number as typed and dials its digits', () => {
    expect(formatPhone('1900 1234')).toEqual({ display: '1900 1234', href: 'tel:19001234' });
  });
});

describe('siteContact', () => {
  it('falls back to the built-in contact values', () => {
    vi.stubEnv('NEXT_PUBLIC_CONTACT_PHONE', '');
    vi.stubEnv('NEXT_PUBLIC_CONTACT_EMAIL', '');
    vi.stubEnv('NEXT_PUBLIC_CONTACT_FACEBOOK', '');
    expect(siteContact()).toEqual({
      phone: { display: '0963 316 273', href: 'tel:+84963316273' },
      email: 'lienhe@vcraft-vn.vercel.app',
      facebook: 'https://www.facebook.com/vcraft.battrang',
    });
  });

  it('lets the environment override each value', () => {
    vi.stubEnv('NEXT_PUBLIC_CONTACT_PHONE', '0901234567');
    vi.stubEnv('NEXT_PUBLIC_CONTACT_EMAIL', ' hello@example.vn ');
    vi.stubEnv('NEXT_PUBLIC_CONTACT_FACEBOOK', 'https://www.facebook.com/example');
    expect(siteContact()).toEqual({
      phone: { display: '0901 234 567', href: 'tel:+84901234567' },
      email: 'hello@example.vn',
      facebook: 'https://www.facebook.com/example',
    });
  });

  it('refuses a non-http Facebook URL', () => {
    vi.stubEnv('NEXT_PUBLIC_CONTACT_FACEBOOK', 'javascript:alert(1)');
    expect(siteContact().facebook).toBe('https://www.facebook.com/vcraft.battrang');
  });
});
