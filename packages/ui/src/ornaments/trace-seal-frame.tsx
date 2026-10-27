import type { ReactNode } from 'react';
import { cn } from '../lib/cn';
import {
  TRACE_FRAME_INNER_PATH,
  TRACE_FRAME_OUTER_PATH,
  TRACE_FRAME_VIEWBOX,
} from './seal-geometry';

export interface TraceSealFrameProps {
  /** Mã truy xuất 8 ký tự, in dưới khung bằng font mono. */
  code: string;
  /** Nội dung đặt trong khung, thường là QR (bộ tạo QR tự lo màu và nền). */
  children: ReactNode;
  /** Cạnh khung, px. Mặc định 200. */
  size?: number;
  /** Nhãn truy cập được cho cả ấn (vd. "Ấn truy xuất"). Không có thì dùng `code`. */
  title?: string;
  className?: string;
}

/**
 * Ấn truy xuất (BRAND §2): khung triện vuông đôi viền màu son bọc QR, mã 8 ký tự bên dưới.
 * Là thứ người dùng thấy ngoài đời thật (tem dán đáy sản phẩm).
 */
export function TraceSealFrame({
  code,
  children,
  size = 200,
  title,
  className,
}: TraceSealFrameProps) {
  return (
    <figure
      className={cn('m-0 inline-flex flex-col items-center', className)}
      style={{ width: size, gap: size * 0.05 }}
      aria-label={title ?? code}
    >
      <div className="relative w-full" style={{ aspectRatio: '1 / 1', padding: size * 0.13 }}>
        <svg
          aria-hidden="true"
          focusable="false"
          viewBox={`0 0 ${TRACE_FRAME_VIEWBOX} ${TRACE_FRAME_VIEWBOX}`}
          className="absolute inset-0 size-full"
          fill="none"
          stroke="var(--color-seal)"
          strokeLinejoin="round"
        >
          <path d={TRACE_FRAME_OUTER_PATH} strokeWidth="2.6" />
          <path d={TRACE_FRAME_INNER_PATH} strokeWidth="0.9" />
        </svg>
        <div className="relative grid size-full place-items-center">{children}</div>
      </div>
      <figcaption
        className="font-mono font-medium text-ink"
        style={{ fontSize: Math.max(11, size * 0.075), letterSpacing: '0.22em' }}
      >
        {code}
      </figcaption>
    </figure>
  );
}
