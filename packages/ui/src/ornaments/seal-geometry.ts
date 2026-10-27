/**
 * Hình học dùng chung của ấn bình gốm (BRAND §2) cho component React và file SVG tĩnh
 * trong `packages/ui/assets/brand/`. Test `test/brand-assets.test.ts` giữ hai nơi đồng bộ.
 */

/** Cạnh viewBox vuông của ấn. */
export const SEAL_VIEWBOX = 40;

/** Hình vuông bo góc không đều như con dấu khắc tay. */
export const SEAL_PATH = 'M5 4.5 Q20 2.5 35.5 5 Q37.5 20 35 35.5 Q20 37.8 4.6 35.2 Q2.4 20 5 4.5 Z';

/** Bình dáng tỏi âm bản: miệng loe, cổ thon, bụng tròn, chân đế. Khoét khỏi ấn. */
export const SEAL_VASE_PATH =
  'M15 7 H25 Q24.6 8.2 23.4 8.8 C23 10.8 23.2 12.8 24.5 14.3 C29.5 16.8 31.5 20.2 31.2 23.6 C30.8 27.4 28 30 26 31 L25 32.6 H15 L14 31 C12 30 9.2 27.4 8.8 23.6 C8.5 20.2 10.5 16.8 15.5 14.3 C16.8 12.8 17 10.8 16.6 8.8 Q15.4 8.2 15 7 Z';

/** Dải sóng hoa lam ngang bụng bình, tô lại màu ấn bên trong phần khoét. */
export const SEAL_BAND_PATH = 'M11.2 22.4 q2.2 -2 4.4 0 t4.4 0 t4.4 0 t4.4 0';
export const SEAL_BAND_STROKE = 1.3;

/** Khung triện của ấn truy xuất, viewBox 100. */
export const TRACE_FRAME_VIEWBOX = 100;
export const TRACE_FRAME_OUTER_PATH =
  'M3.5 3 Q50 0.6 96.5 3.4 Q99.3 50 96.6 96.5 Q50 99.4 3.4 96.6 Q0.7 50 3.5 3 Z';
export const TRACE_FRAME_INNER_PATH =
  'M8.5 8 Q50 6.2 91.5 8.4 Q93.7 50 91.6 91.5 Q50 93.6 8.4 91.6 Q6.3 50 8.5 8 Z';
