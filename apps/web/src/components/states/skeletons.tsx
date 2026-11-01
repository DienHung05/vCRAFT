import { Card, cn, Skeleton } from '@vcraft/ui';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

/*
 * Route `loading.tsx` and Lighthouse: a skeleton that streams first and is replaced by the real page
 * makes the page's real text or hero a *second* LCP candidate, and Lighthouse then charges every
 * script loaded before it to LCP (perf ~75 instead of 100). So public pages whose title or hero comes
 * from data (home, product, news, news article, trace) have no `loading.tsx`, and list pages with
 * a static title repeat it in the skeleton (see `CatalogHeader`). Do not add one without re-measuring.
 */

/** Standard page padding for public and Studio pages (matches the real pages, so nothing jumps). */
export const PAGE_BOX = 'mx-auto max-w-editorial px-gutter pt-12 pb-section';

/**
 * Wraps a group of skeleton blocks: one polite `status` announcement for the whole group and
 * `aria-busy` so assistive technology does not read the empty shapes.
 */
export function LoadingStatus({
  label,
  className,
  children,
}: {
  /** Overrides the generic "Loading…" label. */
  label?: string | undefined;
  className?: string | undefined;
  children: ReactNode;
}) {
  const t = useTranslations('common');
  return (
    <div role="status" aria-busy="true" data-testid="loading-skeleton" className={className}>
      <span className="sr-only">{label ?? t('loading')}</span>
      {children}
    </div>
  );
}

interface SkeletonProps {
  label?: string | undefined;
  /** Wrapper classes; defaults to the standard page box. Pass `''` inside an existing box. */
  className?: string;
}

/** Page heading: a title line and a lead line. */
function HeaderSkeleton({ lead = true }: { lead?: boolean }) {
  return (
    <div className="flex max-w-prose-vn flex-col gap-3">
      <Skeleton className="h-10 w-2/3" />
      {lead ? <Skeleton className="h-5 w-full" /> : null}
    </div>
  );
}

/** List of cards (RFQ list, news list, queues). */
export function ListSkeleton({
  label,
  className = PAGE_BOX,
  rows = 4,
  withHeader = true,
}: SkeletonProps & { rows?: number; withHeader?: boolean }) {
  return (
    <LoadingStatus label={label} className={cn('flex flex-col gap-6', className)}>
      {withHeader ? <HeaderSkeleton /> : null}
      <ul className="flex flex-col gap-4">
        {Array.from({ length: rows }, (_, index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: identical placeholders, never reordered.
          <li key={index}>
            <Card className="flex flex-col gap-3 p-5 md:p-6">
              <Skeleton className="h-5 w-24 rounded-chip" />
              <Skeleton className="h-6 w-3/5" />
              <Skeleton className="h-4 w-4/5" />
            </Card>
          </li>
        ))}
      </ul>
    </LoadingStatus>
  );
}

/** Rows of a table or a compact list (audit log, admin queues, product list). */
export function TableSkeleton({
  label,
  className = PAGE_BOX,
  rows = 6,
  withHeader = true,
}: SkeletonProps & { rows?: number; withHeader?: boolean }) {
  return (
    <LoadingStatus label={label} className={cn('flex flex-col gap-6', className)}>
      {withHeader ? <HeaderSkeleton lead={false} /> : null}
      <ul className="flex flex-col">
        {Array.from({ length: rows }, (_, index) => (
          <li
            // biome-ignore lint/suspicious/noArrayIndexKey: identical placeholders, never reordered.
            key={index}
            className="flex items-center justify-between gap-4 border-ink/10 border-b py-4 last:border-b-0"
          >
            <Skeleton className="h-5 w-1/2" />
            <Skeleton className="h-5 w-20 rounded-chip" />
          </li>
        ))}
      </ul>
    </LoadingStatus>
  );
}

/** Grid of image cards (artisans, products). */
export function CardGridSkeleton({
  label,
  className = PAGE_BOX,
  count = 6,
  withHeader = true,
}: SkeletonProps & { count?: number; withHeader?: boolean }) {
  return (
    <LoadingStatus label={label} className={cn('flex flex-col gap-10', className)}>
      {withHeader ? <HeaderSkeleton /> : null}
      <div className="grid grid-cols-2 gap-6 md:grid-cols-3">
        {Array.from({ length: count }, (_, index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: identical placeholders, never reordered.
          <div key={index}>
            <Skeleton className="aspect-[4/5] rounded-card" />
            <Skeleton className="mt-3 h-4 w-3/4" />
          </div>
        ))}
      </div>
    </LoadingStatus>
  );
}

/** Detail page: big picture on one side, text blocks on the other (product, artisan). */
export function DetailSkeleton({ label, className = PAGE_BOX }: SkeletonProps) {
  return (
    <LoadingStatus label={label} className={cn('flex flex-col gap-8', className)}>
      <Skeleton className="h-4 w-48" />
      <div className="grid gap-10 md:grid-cols-12 md:gap-14">
        <Skeleton className="aspect-[4/5] rounded-card md:col-span-7" />
        <div className="flex flex-col gap-5 md:col-span-5">
          <Skeleton className="h-6 w-28 rounded-chip" />
          <Skeleton className="h-12 w-4/5" />
          <Skeleton className="h-6 w-1/3" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-12 w-48 rounded-input" />
        </div>
      </div>
    </LoadingStatus>
  );
}

/** Long text page (news article, trace page lead). */
export function ArticleSkeleton({ label, className }: SkeletonProps) {
  return (
    <LoadingStatus
      label={label}
      className={cn(
        'mx-auto flex max-w-prose-vn flex-col gap-5 px-gutter pt-12 pb-section',
        className,
      )}
    >
      <Skeleton className="h-4 w-40" />
      <Skeleton className="h-12 w-4/5" />
      <Skeleton className="h-5 w-full" />
      <Skeleton className="aspect-[3/2] rounded-card" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-2/3" />
    </LoadingStatus>
  );
}

/** Form or editor sheet: a few labelled fields and a button. */
export function FormSkeleton({
  label,
  className = PAGE_BOX,
  fields = 4,
}: SkeletonProps & { fields?: number }) {
  return (
    <LoadingStatus label={label} className={cn('flex max-w-3xl flex-col gap-6', className)}>
      <HeaderSkeleton lead={false} />
      <Card className="flex flex-col gap-5 p-5 md:p-8">
        {Array.from({ length: fields }, (_, index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: identical placeholders, never reordered.
          <div key={index} className="flex flex-col gap-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-11 w-full" />
          </div>
        ))}
        <Skeleton className="h-11 w-36" />
      </Card>
    </LoadingStatus>
  );
}

/** Dashboard tiles followed by a card. */
export function DashboardSkeleton({
  label,
  className = PAGE_BOX,
  withTitle = true,
}: SkeletonProps & { withTitle?: boolean }) {
  return (
    <LoadingStatus label={label} className={cn('flex flex-col gap-6', className)}>
      {withTitle ? <HeaderSkeleton lead={false} /> : null}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: identical placeholders, never reordered.
          <Card key={index} className="flex flex-col gap-3 p-4">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-9 w-16" />
          </Card>
        ))}
      </div>
      <Card className="flex flex-col gap-3 p-6">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </Card>
    </LoadingStatus>
  );
}

/** Heading, one wide block (hero, map) and a row of cards underneath. */
export function BannerSkeleton({ label, className = PAGE_BOX }: SkeletonProps) {
  return (
    <LoadingStatus label={label} className={cn('flex flex-col gap-8', className)}>
      <HeaderSkeleton />
      <Skeleton className="h-72 w-full rounded-card md:h-96" />
      <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: identical placeholders, never reordered.
          <Skeleton key={index} className="aspect-[4/5] rounded-card" />
        ))}
      </div>
    </LoadingStatus>
  );
}
