/**
 * Vietnamese citizen ID number (CCCD): 12 digits. Sensitive personal data (NFR-SEC-03): stored only
 * encrypted, shown masked to its owner and in full only through an audited admin reveal.
 */
export const ID_NUMBER_PATTERN = /^\d{12}$/;

export function isValidIdNumber(value: string): boolean {
  return ID_NUMBER_PATTERN.test(value);
}

/** `••••••••1234`: everything but the last four digits hidden. */
export function maskIdNumber(value: string): string {
  return `${'•'.repeat(Math.max(0, value.length - 4))}${value.slice(-4)}`;
}
