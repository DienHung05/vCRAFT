/** CRC-16/CCITT-FALSE, the checksum that closes an EMVCo QR payload. */
export function crc16Ccitt(text: string): string {
  let crc = 0xffff;
  for (let index = 0; index < text.length; index++) {
    crc ^= text.charCodeAt(index) << 8;
    for (let bit = 0; bit < 8; bit++) {
      crc = (crc & 0x8000) !== 0 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

/** One EMVCo tag-length-value field; the length is the number of characters, two digits. */
const field = (id: string, value: string) =>
  `${id}${String(value.length).padStart(2, '0')}${value}`;

export interface VietQrInput {
  /** The receiving bank's six-digit NAPAS BIN, e.g. `970422`. */
  bankBin: string;
  accountNumber: string;
  amountVnd: number;
  /** The transfer content (the payment code). */
  content: string;
}

/**
 * The VietQR payload (NAPAS 247 by account, EMVCo merchant-presented, dynamic) that a bank app scans to fill in
 * the account, the amount and the transfer content. The same string encodes into the QR image.
 */
export function buildVietQrPayload(input: VietQrInput): string {
  const account = field('00', input.bankBin) + field('01', input.accountNumber);
  const merchant = field('00', 'A000000727') + field('01', account) + field('02', 'QRIBFTTA');
  const body =
    field('00', '01') +
    field('01', '12') +
    field('38', merchant) +
    field('53', '704') +
    field('54', String(input.amountVnd)) +
    field('58', 'VN') +
    field('62', field('08', input.content));
  const withCrcTag = `${body}6304`;
  return `${withCrcTag}${crc16Ccitt(withCrcTag)}`;
}
