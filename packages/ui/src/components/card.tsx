import type { HTMLAttributes } from 'react';
import { cn } from '../lib/cn';

/** Khối nổi trên nền giấy: bo 12px, bóng ấm (BRAND §5). */
export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('rounded-card bg-surface shadow-warm ring-1 ring-ink/5', className)}
      {...props}
    />
  );
}
