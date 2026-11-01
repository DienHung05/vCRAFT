import { cn } from '@vcraft/ui';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { type BreadcrumbInput, buildBreadcrumbTrail } from '@/lib/breadcrumbs';

/**
 * Breadcrumb trail for deep pages (SRS §5.1): a labelled `nav` with an ordered list, the last
 * crumb marked `aria-current="page"` and not linked. Renders nothing for a trail shorter than two
 * crumbs. Works in server and client components.
 */
export function Breadcrumbs({
  items,
  className,
}: {
  items: readonly (BreadcrumbInput | false | null | undefined)[];
  className?: string;
}) {
  const t = useTranslations('common');
  const trail = buildBreadcrumbTrail(items);
  if (trail.length === 0) return null;
  return (
    <nav aria-label={t('breadcrumb')} className={cn('text-small text-ash', className)}>
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-1">
        {trail.map((crumb, index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: the trail is static per render and labels may repeat.
          <li key={index} className="flex min-w-0 items-center gap-2">
            {crumb.current || crumb.href === undefined ? (
              <span
                {...(crumb.current ? { 'aria-current': 'page' as const } : {})}
                className={cn('break-words', crumb.current && 'text-ink')}
              >
                {crumb.label}
              </span>
            ) : (
              <Link href={crumb.href} className="underline-offset-4 hover:text-ink hover:underline">
                {crumb.label}
              </Link>
            )}
            {crumb.current ? null : <span aria-hidden="true">/</span>}
          </li>
        ))}
      </ol>
    </nav>
  );
}
