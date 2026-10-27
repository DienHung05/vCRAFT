import type { Formats } from 'next-intl';

/** Định dạng dùng chung: tiền VND, ngày ngắn/dài. */
export const formats = {
  number: {
    vnd: { style: 'currency', currency: 'VND', maximumFractionDigits: 0 },
    compact: { notation: 'compact', maximumFractionDigits: 1 },
  },
  dateTime: {
    short: { day: '2-digit', month: '2-digit', year: 'numeric' },
    long: { day: 'numeric', month: 'long', year: 'numeric' },
    stamp: { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' },
  },
} satisfies Formats;
