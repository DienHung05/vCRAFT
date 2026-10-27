import { cn } from '../lib/cn';
import { SEAL_BAND_PATH, SEAL_BAND_STROKE, SEAL_VASE_PATH } from './seal-geometry';

export interface VaseFigureProps {
  /** Màu thân bình. Mặc định men lam. */
  body?: string;
  /** Màu dải sóng hoa lam. Mặc định màu giấy. */
  band?: string;
  className?: string;
}

/**
 * Bình dáng tỏi của ấn (BRAND §2) dựng thành hình độc lập: ảnh tĩnh thay hero 3D khi giảm
 * chuyển động, và hình minh họa chỗ ảnh sản phẩm chưa có. Cùng hình học với logo.
 */
export function VaseFigure({
  body = 'var(--color-glaze)',
  band = 'var(--color-paper)',
  className,
}: VaseFigureProps) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="8 6 24 27.6"
      className={cn('block', className)}
    >
      <path d={SEAL_VASE_PATH} fill={body} />
      <path
        d={SEAL_BAND_PATH}
        fill="none"
        stroke={band}
        strokeWidth={SEAL_BAND_STROKE * 0.7}
        strokeLinecap="round"
      />
    </svg>
  );
}
