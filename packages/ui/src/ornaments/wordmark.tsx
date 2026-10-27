import { cn } from '../lib/cn';

export interface WordmarkProps {
  /** Cỡ chữ, px. Mặc định 28. */
  size?: number;
  className?: string;
}

/**
 * Wordmark `vCraft` (BRAND §2): Fraunces, SOFT cao + WONK bật; *v* thường, *C* hoa như vành miệng bình.
 * Màu theo `currentColor`.
 */
export function Wordmark({ size = 28, className }: WordmarkProps) {
  return (
    <span
      className={cn(
        'font-display type-wonk select-none whitespace-nowrap font-semibold',
        className,
      )}
      style={{ fontSize: size, lineHeight: 1, letterSpacing: '-0.02em' }}
    >
      vCraft
    </span>
  );
}
