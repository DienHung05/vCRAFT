/**
 * Token chuyển động vCraft — nguồn chuẩn: docs/BRAND.md §6.2.
 * Giá trị phải khớp `--ease-*` và `--duration-*` trong ../tokens/theme.css.
 */

/** Easing dạng mảng bezier (đối số của Motion/GSAP `CustomEase`). */
export const ease = {
  /** Mặc định: vào khung, mở rộng. */
  clay: [0.22, 1, 0.36, 1],
  /** Chuyển cảnh, đổi trạng thái. */
  kiln: [0.65, 0, 0.35, 1],
  /** Ấn triện, nút bấm (nảy nhẹ). */
  press: [0.34, 1.56, 0.64, 1],
} as const satisfies Record<string, readonly [number, number, number, number]>;

/** Chuỗi CSS tương ứng, dùng cho `transition-timing-function` viết tay. */
export const easeCss = {
  clay: 'cubic-bezier(0.22, 1, 0.36, 1)',
  kiln: 'cubic-bezier(0.65, 0, 0.35, 1)',
  press: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
} as const;

/** Lò xo cho kéo-thả, layout. */
export const spring = {
  clay: { type: 'spring', stiffness: 260, damping: 26, mass: 0.9 },
} as const;

/** Thời lượng theo mili giây (CSS, setTimeout). */
export const durMs = {
  instant: 90,
  quick: 160,
  base: 280,
  slow: 520,
  story: 900,
} as const;

/** Thời lượng theo giây (Motion, GSAP). */
export const dur = {
  instant: durMs.instant / 1000,
  quick: durMs.quick / 1000,
  base: durMs.base / 1000,
  slow: durMs.slow / 1000,
  story: durMs.story / 1000,
} as const;

/** Trễ giữa các phần tử danh sách/lưới: 40ms, tối đa 12 phần tử (phần tử thứ 13 trở đi không trễ thêm). */
export const stagger = {
  list: { step: 0.04, stepMs: 40, max: 12 },
} as const;

/** Độ trễ (giây) của phần tử thứ `index` (đếm từ 0) trong danh sách, chặn ở 12 phần tử. */
export function staggerDelay(index: number): number {
  const capped = Math.min(Math.max(index, 0), stagger.list.max - 1);
  return capped * stagger.list.step;
}

/** Thời lượng mờ dần thay thế mọi chuyển động khi `prefers-reduced-motion: reduce` (BRAND §6.4). */
export const reducedFadeMs = 150;
