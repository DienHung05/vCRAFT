/**
 * Pure text helpers for the Fox assistant's guardrails (PLAN E15, NFR-SEC-09). No framework, no I/O.
 */

// C0/C1 controls except tab and newline, zero-width characters, the BOM, and the bidi controls that can
// hide or reorder text (Trojan Source). Built from escapes so no invisible character sits in the source.
const INVISIBLE = new RegExp(
  [
    '[',
    '\u0000-\u0008\u000b-\u001f\u007f-\u009f', // controls, keeping tab and newline
    '\u200b-\u200f\u2028\u2029', // zero-width, LRM/RLM, line and paragraph separators
    '\u202a-\u202e\u2066-\u2069', // bidi embeddings, overrides and isolates
    '\u2060-\u2064\ufeff', // word joiner, invisible operators, BOM
    ']',
  ].join(''),
  'g',
);

/**
 * Canonical form of user text: NFKC (full-width and compatibility letters fold into plain ones, so
 * "ｉｇｎｏｒｅ" reads "ignore"), invisible and bidi characters removed, runs of spaces collapsed, ends trimmed.
 * Vietnamese diacritics are kept.
 */
export function normalizeUserText(input: string): string {
  return input
    .normalize('NFKC')
    .replace(INVISIBLE, '')
    .replace(/[^\S\n]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Lower-case ASCII form for intent matching: diacritics folded, `đ` → `d`, so "Chào Cáo", "chao cao" and
 * "CHÀO CÁO" match the same rule. Punctuation and spaces are kept.
 */
// biome-ignore lint/complexity/useRegexLiterals: a literal would let the formatter write the marks as raw characters.
const COMBINING_MARKS = new RegExp('[\u0300-\u036f]', 'g');

export function foldVietnamese(input: string): string {
  return input.normalize('NFD').replace(COMBINING_MARKS, '').replace(/[đĐ]/g, 'd').toLowerCase();
}

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
// Twelve-digit citizen ID numbers (CCCD), alone or written in groups of 3–4.
const CCCD = /(?<!\d)\d{3}[ .-]?\d{3}[ .-]?\d{3}[ .-]?\d{3}(?!\d)/g;
// Vietnamese mobile and landline numbers: 0 or +84, then 9–10 digits, with optional separators.
const PHONE = /(?<![\d+])(?:\+?84|0)(?:[ .-]?\d){8,9}(?!\d)/g;

/** Replaces e-mail addresses, Vietnamese phone numbers and citizen ID numbers with placeholders. */
export function maskPii(input: string): string {
  return input.replace(EMAIL, '[email]').replace(CCCD, '[cccd]').replace(PHONE, '[phone]');
}

/**
 * Whether a link in an answer may be shown: a same-site path (`/vi/san-pham/x`), or an absolute URL on
 * one of the allowed origins. Protocol-relative, `javascript:`, `data:` and any other host are refused.
 */
export function isAllowedLink(href: string, allowedOrigins: readonly string[] = []): boolean {
  const value = href.trim();
  if (value.startsWith('/')) return !value.startsWith('//') && !value.includes('\\');
  const origin = originOf(value);
  return origin !== null && allowedOrigins.some((allowed) => originOf(allowed) === origin);
}

/** `scheme://host[:port]` of an http(s) URL, lower-cased; `null` for anything else. */
function originOf(url: string): string | null {
  const match = /^(https?):\/\/([^/?#\\@\s]+)(?:[/?#]|$)/i.exec(url);
  return match ? `${match[1]}://${match[2]}`.toLowerCase() : null;
}
