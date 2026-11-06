const DIGITS = ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];
// Group names within one "tỷ" cycle; above that the cycle repeats ("một nghìn tỷ", "một triệu tỷ").
const GROUPS = ['', 'nghìn', 'triệu'];

/**
 * Reads a three-digit group. `full` makes a group that follows a larger one say its hundreds and the
 * "linh" for a lone unit ("không trăm linh năm"), as on a cheque.
 */
function readGroup(n: number, full: boolean): string {
  const hundreds = Math.floor(n / 100);
  const tens = Math.floor((n % 100) / 10);
  const units = n % 10;
  const words: string[] = [];
  if (hundreds > 0 || full) words.push(DIGITS[hundreds] as string, 'trăm');
  if (tens > 1) {
    words.push(DIGITS[tens] as string, 'mươi');
    if (units === 1) words.push('mốt');
    else if (units === 5) words.push('lăm');
    else if (units > 0) words.push(DIGITS[units] as string);
  } else if (tens === 1) {
    words.push('mười');
    if (units === 5) words.push('lăm');
    else if (units > 0) words.push(DIGITS[units] as string);
  } else if (units > 0) {
    if (words.length > 0) words.push('linh');
    words.push(DIGITS[units] as string);
  }
  return words.join(' ');
}

/** Reads a positive whole number, recursing on each "tỷ". */
function readNumber(n: number, full: boolean): string {
  if (n >= 1e9) {
    const billions = Math.floor(n / 1e9);
    const rest = n % 1e9;
    const head = `${readNumber(billions, full)} tỷ`;
    return rest === 0 ? head : `${head} ${readNumber(rest, true)}`;
  }
  const groups: string[] = [];
  let remaining = n;
  for (let i = 0; remaining > 0; i++) {
    const group = remaining % 1000;
    remaining = Math.floor(remaining / 1000);
    if (group > 0) {
      // Every group but the leading one is read in full ("một nghìn không trăm linh năm").
      const words = readGroup(group, remaining > 0 || full);
      groups.unshift(GROUPS[i] ? `${words} ${GROUPS[i]}` : words);
    }
  }
  return groups.join(' ');
}

/**
 * A VND amount in Vietnamese words, capitalized and ending in "đồng", as written under a price
 * (PLAN S6): `1_250_000` gives "Một triệu hai trăm năm mươi nghìn đồng". Returns `null` for anything
 * that is not a non-negative safe integer.
 */
export function vndInWords(amount: number): string | null {
  if (!Number.isSafeInteger(amount) || amount < 0) return null;
  const words = amount === 0 ? 'không' : readNumber(amount, false);
  return `${words.charAt(0).toUpperCase()}${words.slice(1)} đồng`;
}
