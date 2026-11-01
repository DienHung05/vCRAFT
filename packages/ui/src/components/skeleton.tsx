import type { HTMLAttributes } from 'react';
import { cn } from '../lib/cn';

/**
 * Placeholder block shown while data loads. Decorative (`aria-hidden`): the wrapper that groups
 * several of them carries the `role="status"` label. The pulse stops under reduced motion.
 */
export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden="true"
      className={cn('animate-pulse rounded-input bg-ink/8 motion-reduce:animate-none', className)}
      {...props}
    />
  );
}
