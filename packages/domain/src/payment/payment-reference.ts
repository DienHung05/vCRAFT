/**
 * The payment code that goes into the bank transfer content, `vnp_TxnRef` or MoMo `orderId`: a fixed
 * prefix and ten characters from an alphabet without look-alikes (no 0/O, 1/I/L). Banks upper-case the
 * transfer content and may strip separators, so the code is upper-case letters and digits only.
 */
export const PAYMENT_REFERENCE_PREFIX = 'VCP';
const ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
const SUFFIX_LENGTH = 10;
const CODE_BODY = `${PAYMENT_REFERENCE_PREFIX}[${ALPHABET}]{${SUFFIX_LENGTH}}`;

export type RandomBytes = (length: number) => Uint8Array;

/** A fresh payment code. `random` supplies cryptographically strong bytes (the domain has no runtime of its own). */
export function newReferenceCode(random: RandomBytes): string {
  let suffix = '';
  // Rejection sampling keeps every character equally likely.
  const limit = 256 - (256 % ALPHABET.length);
  while (suffix.length < SUFFIX_LENGTH) {
    for (const byte of random(SUFFIX_LENGTH * 2)) {
      if (byte < limit && suffix.length < SUFFIX_LENGTH) suffix += ALPHABET[byte % ALPHABET.length];
    }
  }
  return `${PAYMENT_REFERENCE_PREFIX}${suffix}`;
}

export function isReferenceCode(value: string): boolean {
  return new RegExp(`^${CODE_BODY}$`).test(value);
}

/**
 * The payment code inside free transfer content, or `null`. Matching ignores case and the spaces, dashes and
 * dots a bank app or the SePay `code` field may add around it.
 */
export function extractReferenceCode(content: string | null | undefined): string | null {
  if (!content) return null;
  const squeezed = content.toUpperCase().replace(/[\s._-]+/g, '');
  return new RegExp(CODE_BODY).exec(squeezed)?.[0] ?? null;
}
