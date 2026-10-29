import { randomInt } from 'node:crypto';

/** Bảng chữ không gây nhầm khi đọc trên nhãn (bỏ 0/O, 1/I/L). */
const ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
export const TRACE_CODE_LENGTH = 8;

/** Mã truy xuất in trên QR (`/q/<code>`), sinh bằng CSPRNG nên không đoán tuần tự được. */
export function generateTraceCode(): string {
  let code = '';
  for (let i = 0; i < TRACE_CODE_LENGTH; i++) code += ALPHABET[randomInt(ALPHABET.length)];
  return code;
}
