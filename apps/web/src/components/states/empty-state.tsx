import { cn } from '@vcraft/ui';
import type { ReactNode } from 'react';
import { EmptyIllustration, type EmptyIllustrationName } from './empty-illustration';

export interface EmptyStateProps {
  title: string;
  description?: string | undefined;
  /** Call to action (a link or button); every empty state should offer a next step. */
  action?: ReactNode;
  illustration?: EmptyIllustrationName;
  /** Heading level of the title; pick the one that follows the surrounding heading. */
  headingLevel?: 'h2' | 'h3';
  className?: string;
}

/**
 * Shared "nothing here yet" block: illustration, short title, optional explanation and a call to
 * action. Not a live region: it is static content that appears with the loaded page.
 */
export function EmptyState({
  title,
  description,
  action,
  illustration = 'bowl',
  headingLevel: Heading = 'h2',
  className,
}: EmptyStateProps) {
  return (
    <div
      data-testid="empty-state"
      className={cn(
        'mx-auto flex max-w-prose-vn flex-col items-center gap-3 px-4 py-10 text-center',
        className,
      )}
    >
      <EmptyIllustration name={illustration} />
      <Heading className="text-h3">{title}</Heading>
      {description ? <p className="max-w-md text-ash">{description}</p> : null}
      {action ? <div className="mt-2 flex flex-wrap justify-center gap-3">{action}</div> : null}
    </div>
  );
}
