/**
 * Public contact details shown in the site footer. Everything a person might need to change lives
 * here, so swapping a placeholder for the real value is a one-line edit (or an env override).
 *
 * Overrides, inlined by Next at build time (on Vercel set them before building):
 * - `NEXT_PUBLIC_CONTACT_PHONE`: a Vietnamese number in any common form (`0963316273`, `+84 963 316 273`).
 * - `NEXT_PUBLIC_CONTACT_EMAIL`: a plain address.
 * - `NEXT_PUBLIC_CONTACT_FACEBOOK`: the full page URL.
 */

const DEFAULT_PHONE = '0963316273';
// Placeholder accepted by the owner until a real mailbox exists.
const DEFAULT_EMAIL = 'lienhe@vcraft.click';
// Placeholder accepted by the owner until the real page exists.
const DEFAULT_FACEBOOK = 'https://www.facebook.com/vcraft.battrang';

/** Support window, local time in Vietnam (shown as a plain line; edit here to change it). */
export const SUPPORT_HOURS = { open: '08:00', close: '17:00' } as const;

export interface PhoneNumber {
  /** Human-readable, e.g. `0963 316 273`. */
  display: string;
  /** Dialable `tel:` target in international form, e.g. `tel:+84963316273`. */
  href: string;
}

export interface SiteContact {
  phone: PhoneNumber;
  email: string;
  facebook: string;
}

/**
 * Turns a Vietnamese phone number typed in any common form into a display string and a `tel:` link.
 * A 10-digit national number (`0xxx xxx xxx`) is grouped 4-3-3; anything else is shown as given and
 * dialled by its digits.
 */
export function formatPhone(raw: string): PhoneNumber {
  const trimmed = raw.trim();
  const digits = trimmed.replace(/\D/g, '');
  const national = digits.startsWith('84') ? `0${digits.slice(2)}` : digits;
  if (/^0\d{9}$/.test(national)) {
    return {
      display: `${national.slice(0, 4)} ${national.slice(4, 7)} ${national.slice(7)}`,
      href: `tel:+84${national.slice(1)}`,
    };
  }
  return { display: trimmed, href: `tel:${trimmed.startsWith('+') ? '+' : ''}${digits}` };
}

/** Only an http(s) URL may be linked; anything else falls back to the default page. */
function safeUrl(value: string | undefined, fallback: string): string {
  const candidate = value?.trim();
  if (!candidate) return fallback;
  try {
    const url = new URL(candidate);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : fallback;
  } catch {
    return fallback;
  }
}

export function siteContact(): SiteContact {
  return {
    phone: formatPhone(process.env.NEXT_PUBLIC_CONTACT_PHONE?.trim() || DEFAULT_PHONE),
    email: process.env.NEXT_PUBLIC_CONTACT_EMAIL?.trim() || DEFAULT_EMAIL,
    facebook: safeUrl(process.env.NEXT_PUBLIC_CONTACT_FACEBOOK, DEFAULT_FACEBOOK),
  };
}
