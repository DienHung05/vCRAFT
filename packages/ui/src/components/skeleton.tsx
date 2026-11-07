import type { HTMLAttributes } from 'react';
import { cn } from '../lib/cn';

/**
 * Placeholder block shown while data loads: "unfired clay" with a soft sheen drifting across it (BRAND §6.3
 * micro-interactions; `.clay-skeleton` in theme.css, transform only). Decorative (`aria-hidden`): the
 * wrapper that groups several of them carries the `role="status"` label. The sheen stops under reduced motion.
 */
export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div aria-hidden="true" className={cn('clay-skeleton rounded-input', className)} {...props} />
  );
}
