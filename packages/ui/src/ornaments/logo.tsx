import { cn } from '../lib/cn';
import { SealMark, type SealVariant } from './seal-mark';
import { Wordmark } from './wordmark';

export interface LogoProps {
  /** Chiều cao ấn, px (wordmark co theo). Tối thiểu 20 trên màn hình. Mặc định 40. */
  size?: number;
  variant?: SealVariant;
  className?: string;
}

/**
 * Logo đầy đủ: ấn bình + wordmark (BRAND §2). Tên truy cập được lấy từ chữ "vCraft"; ấn là trang trí.
 * Chừa vùng an toàn bằng ½ chiều cao ấn quanh logo khi bố cục.
 */
export function Logo({ size = 40, variant = 'seal', className }: LogoProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center text-ink',
        variant === 'inverse' && 'text-paper',
        className,
      )}
      style={{ gap: size * 0.3 }}
    >
      <SealMark size={size} variant={variant} />
      <Wordmark size={Math.round(size * 0.9)} />
    </span>
  );
}
