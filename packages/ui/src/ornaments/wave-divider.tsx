import { useId } from 'react';
import { cn } from '../lib/cn';

export interface WaveDividerProps {
  className?: string;
}

/**
 * Dải sóng nước kiểu gốm hoa lam làm vạch ngăn section (BRAND §5). Trang trí thuần, màu `--color-glaze`.
 */
export function WaveDivider({ className }: WaveDividerProps) {
  const id = `wave-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      className={cn('block h-4 w-full text-glaze', className)}
      preserveAspectRatio="none"
    >
      <defs>
        <pattern id={id} width="32" height="16" patternUnits="userSpaceOnUse">
          <path
            d="M0 9 q8 -7 16 0 t16 0"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinecap="round"
          />
          <circle cx="16" cy="13.5" r="0.9" fill="currentColor" opacity="0.6" />
        </pattern>
      </defs>
      <line x1="0" y1="1" x2="100%" y2="1" stroke="currentColor" strokeWidth="0.8" opacity="0.5" />
      <rect y="2" width="100%" height="14" fill={`url(#${id})`} />
    </svg>
  );
}
