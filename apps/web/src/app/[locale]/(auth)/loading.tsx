import { Skeleton } from '@vcraft/ui';
import { LoadingStatus } from '@/components/states/skeletons';
import { KilnShell } from '@/features/auth/kiln/kiln-shell';

/**
 * Placeholder for the sign-in family of pages while the server resolves the session. It renders inside the
 * same kiln scene (rendered by the layout) and card as the real pages, so nothing flashes when the page streams in (the brush
 * ornaments are left out: they draw on when the page itself arrives).
 */
export default function Loading() {
  return (
    <KilnShell
      ornaments={false}
      header={
        <>
          <Skeleton className="h-9 w-2/3" />
          <Skeleton className="h-5 w-full" />
        </>
      }
    >
      <LoadingStatus className="flex flex-col gap-5">
        {[0, 1].map((field) => (
          <div key={field} className="flex flex-col gap-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-11 w-full" />
          </div>
        ))}
        <Skeleton className="h-12 w-full" />
      </LoadingStatus>
    </KilnShell>
  );
}
