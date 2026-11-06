/**
 * Vietnamese lunar calendar (âm lịch) for the Fox assistant's date answers (PLAN E15, FR-AST-03).
 * Astronomical algorithm by Hồ Ngọc Đức (new moons and solar terms after Jean Meeus), computed for
 * UTC+7, the time zone the Vietnamese calendar is defined in.
 */

const TIME_ZONE_HOURS = 7;
const { floor, sin, PI } = Math;
const DR = PI / 180;

export interface LunarDate {
  day: number;
  month: number;
  year: number;
  /** True for a leap (nhuận) month. */
  leap: boolean;
}

/** Julian day number of a Gregorian date. */
function julianDay(dd: number, mm: number, yy: number): number {
  const a = floor((14 - mm) / 12);
  const y = yy + 4800 - a;
  const m = mm + 12 * a - 3;
  return (
    dd + floor((153 * m + 2) / 5) + 365 * y + floor(y / 4) - floor(y / 100) + floor(y / 400) - 32045
  );
}

/** Julian day (fractional, UT) of the k-th new moon after 1 Jan 1900. */
function newMoon(k: number): number {
  const T = k / 1236.85;
  const T2 = T * T;
  const T3 = T2 * T;
  let jd = 2415020.75933 + 29.53058868 * k + 0.0001178 * T2 - 0.000000155 * T3;
  jd += 0.00033 * sin((166.56 + 132.87 * T - 0.009173 * T2) * DR);
  const M = 359.2242 + 29.10535608 * k - 0.0000333 * T2 - 0.00000347 * T3;
  const Mpr = 306.0253 + 385.81691806 * k + 0.0107306 * T2 + 0.00001236 * T3;
  const F = 21.2964 + 390.67050646 * k - 0.0016528 * T2 - 0.00000239 * T3;
  let c = (0.1734 - 0.000393 * T) * sin(M * DR) + 0.0021 * sin(2 * DR * M);
  c -= 0.4068 * sin(Mpr * DR) - 0.0161 * sin(DR * 2 * Mpr);
  c -= 0.0004 * sin(DR * 3 * Mpr);
  c += 0.0104 * sin(DR * 2 * F) - 0.0051 * sin(DR * (M + Mpr));
  c -= 0.0074 * sin(DR * (M - Mpr)) - 0.0004 * sin(DR * (2 * F + M));
  c -= 0.0004 * sin(DR * (2 * F - M)) - 0.0006 * sin(DR * (2 * F + Mpr));
  c += 0.001 * sin(DR * (2 * F - Mpr)) + 0.0005 * sin(DR * (2 * Mpr + M));
  const deltaT =
    T < -11
      ? 0.001 + 0.000839 * T + 0.0002261 * T2 - 0.00000845 * T3 - 0.000000081 * T * T3
      : -0.000278 + 0.000265 * T + 0.000262 * T2;
  return jd + c - deltaT;
}

/** Local day number on which the k-th new moon falls. */
function newMoonDay(k: number): number {
  return floor(newMoon(k) + 0.5 + TIME_ZONE_HOURS / 24);
}

/** Sector (0–11, 30° each) of the sun's longitude at the start of a local day. */
function sunSector(dayNumber: number): number {
  const T = (dayNumber - 0.5 - TIME_ZONE_HOURS / 24 - 2451545.0) / 36525;
  const T2 = T * T;
  const M = 357.5291 + 35999.0503 * T - 0.0001559 * T2 - 0.00000048 * T * T2;
  const L0 = 280.46645 + 36000.76983 * T + 0.0003032 * T2;
  let dl = (1.9146 - 0.004817 * T - 0.000014 * T2) * sin(DR * M);
  dl += (0.019993 - 0.000101 * T) * sin(DR * 2 * M) + 0.00029 * sin(DR * 3 * M);
  let longitude = (L0 + dl) * DR;
  longitude -= PI * 2 * floor(longitude / (PI * 2));
  return floor((longitude / PI) * 6);
}

/** Day number of the start of lunar month 11 (the month containing the winter solstice) of a year. */
function lunarMonth11(yy: number): number {
  const k = floor((julianDay(31, 12, yy) - 2415021) / 29.530588853);
  const day = newMoonDay(k);
  return sunSector(day) >= 9 ? newMoonDay(k - 1) : day;
}

/** Index of the leap month after month 11 in a 13-month lunar year: the first month without a solar term. */
function leapMonthOffset(a11: number): number {
  const k = floor((a11 - 2415021.076998695) / 29.530588853 + 0.5);
  let i = 1;
  let arc = sunSector(newMoonDay(k + i));
  let last: number;
  do {
    last = arc;
    i++;
    arc = sunSector(newMoonDay(k + i));
  } while (arc !== last && i < 14);
  return i - 1;
}

/** The lunar date of a Gregorian calendar day (year, month 1–12, day). */
export function solarToLunar(yy: number, mm: number, dd: number): LunarDate {
  const dayNumber = julianDay(dd, mm, yy);
  const k = floor((dayNumber - 2415021.076998695) / 29.530588853);
  let monthStart = newMoonDay(k + 1);
  if (monthStart > dayNumber) monthStart = newMoonDay(k);
  let a11 = lunarMonth11(yy);
  let b11 = a11;
  let year: number;
  if (a11 >= monthStart) {
    year = yy;
    a11 = lunarMonth11(yy - 1);
  } else {
    year = yy + 1;
    b11 = lunarMonth11(yy + 1);
  }
  const day = dayNumber - monthStart + 1;
  const diff = floor((monthStart - a11) / 29);
  let leap = false;
  let month = diff + 11;
  if (b11 - a11 > 365) {
    const leapDiff = leapMonthOffset(a11);
    if (diff >= leapDiff) {
      month = diff + 10;
      leap = diff === leapDiff;
    }
  }
  if (month > 12) month -= 12;
  if (month >= 11 && diff < 4) year -= 1;
  return { day, month, year, leap };
}

/** The lunar date of an instant, read on the Vietnamese calendar day (Asia/Ho_Chi_Minh). */
export function lunarDateOf(instant: Date): LunarDate {
  const [y, m, d] = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' })
    .format(instant)
    .split('-')
    .map(Number) as [number, number, number];
  return solarToLunar(y, m, d);
}

const STEMS = ['Giáp', 'Ất', 'Bính', 'Đinh', 'Mậu', 'Kỷ', 'Canh', 'Tân', 'Nhâm', 'Quý'];
const BRANCHES = [
  'Tý',
  'Sửu',
  'Dần',
  'Mão',
  'Thìn',
  'Tỵ',
  'Ngọ',
  'Mùi',
  'Thân',
  'Dậu',
  'Tuất',
  'Hợi',
];

/** The sexagenary (can chi) name of a lunar year: 2026 → "Bính Ngọ". */
export function lunarYearName(year: number): string {
  return `${STEMS[(year + 6) % 10]} ${BRANCHES[(year + 8) % 12]}`;
}
