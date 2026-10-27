import { cva, type VariantProps } from 'class-variance-authority';
import type { HTMLAttributes } from 'react';
import { cn } from '../lib/cn';

/**
 * Nhãn dạng chip (bo 999px, BRAND §5). Tông màu theo vai trò ngữ nghĩa:
 * `celadon` đang mở/thành công, `lacquer` chứng nhận, `seal` xác thực, `glaze` thông tin.
 */
export const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-chip px-2.5 py-0.5 text-small font-medium leading-6 whitespace-nowrap',
  {
    variants: {
      tone: {
        neutral: 'bg-ink/6 text-ink',
        clay: 'bg-clay/12 text-clay',
        glaze: 'bg-glaze/10 text-glaze',
        celadon: 'bg-celadon/15 text-ink',
        lacquer: 'bg-lacquer/14 text-ink',
        seal: 'bg-seal/10 text-seal',
        outline: 'border border-ink/20 text-ash',
      },
    },
    defaultVariants: { tone: 'neutral' },
  },
);

export interface BadgeProps
  extends HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, tone, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}
