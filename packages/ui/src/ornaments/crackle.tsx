import { useId } from 'react';
import { cn } from '../lib/cn';

export interface CrackleProps {
  /** Độ đậm nét rạn, 0–1. Mặc định 0.18. */
  opacity?: number;
  className?: string;
}

/** Ô lặp 120px của mạng rạn: các vết nứt cắt nhau không đều như men rạn Bát Tràng. */
const CRACKLE_TILE =
  'M0 18 L22 24 L41 9 L60 0 M41 9 L48 33 L30 52 L22 24 M48 33 L74 38 L92 20 L120 18 M92 20 L86 0 ' +
  'M74 38 L80 61 L104 70 L120 64 M80 61 L62 78 L30 52 L8 66 L0 64 M62 78 L70 104 L96 99 L104 70 ' +
  'M70 104 L60 120 M96 99 L120 112 M30 52 L36 86 L12 98 L0 96 M36 86 L62 78 M36 86 L44 120 M12 98 L18 120';

/**
 * Men rạn (BRAND §5): nền cho khối xác thực, QR, trạng thái rỗng, và báo lỗi tổng chia đơn.
 * Phủ tuyệt đối lên khối cha `relative`; màu theo `currentColor`.
 */
export function Crackle({ opacity = 0.18, className }: CrackleProps) {
  const id = `crackle-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      className={cn('pointer-events-none absolute inset-0 size-full', className)}
    >
      <defs>
        <pattern id={id} width="120" height="120" patternUnits="userSpaceOnUse">
          <path
            d={CRACKLE_TILE}
            fill="none"
            stroke="currentColor"
            strokeWidth="0.8"
            strokeLinejoin="round"
            opacity={opacity}
          />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  );
}
