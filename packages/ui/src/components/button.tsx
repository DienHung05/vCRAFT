import { cva, type VariantProps } from 'class-variance-authority';
import type { ButtonHTMLAttributes } from 'react';
import { cn } from '../lib/cn';

/**
 * Kiểu nút dùng chung. Xuất riêng để link (`<Link className={buttonVariants()}>`) trông như nút
 * mà không cần bọc thêm phần tử. Bấm có nảy nhẹ (BRAND §6.2 `ease.press`), tắt khi giảm chuyển động.
 */
export const buttonVariants = cva(
  [
    'inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap font-medium',
    'transition-[background-color,color,border-color,transform] duration-(--duration-quick) ease-press',
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-glaze',
    'active:scale-[0.97] motion-reduce:active:scale-100',
    'disabled:pointer-events-none disabled:opacity-45',
  ],
  {
    variants: {
      variant: {
        /** Hành động chính: đất nung. */
        primary:
          'bg-clay text-paper hover:bg-[color-mix(in_oklch,var(--color-clay)_86%,var(--color-ink))]',
        /** Hành động phụ: viền mực mảnh. */
        secondary:
          'border border-ink/20 bg-transparent text-ink hover:border-ink/45 hover:bg-ink/5',
        ghost: 'bg-transparent text-ink hover:bg-ink/6',
        /** Chỉ cho khoảnh khắc xác thực/chốt (BRAND §3.1: son triện hiếm ⇒ có sức nặng). */
        seal: 'bg-seal text-paper hover:bg-[color-mix(in_oklch,var(--color-seal)_86%,var(--color-ink))]',
      },
      size: {
        sm: 'h-9 rounded-input px-3 text-small',
        md: 'h-11 rounded-input px-5 text-small',
        lg: 'h-13 rounded-input px-7 text-body',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);

export type ButtonVariantProps = VariantProps<typeof buttonVariants>;

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, ButtonVariantProps {}

export function Button({ className, variant, size, type = 'button', ...props }: ButtonProps) {
  return (
    <button type={type} className={cn(buttonVariants({ variant, size }), className)} {...props} />
  );
}
