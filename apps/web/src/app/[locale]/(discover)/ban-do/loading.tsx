import { Skeleton } from '@vcraft/ui';
import { LoadingStatus } from '@/components/states/skeletons';
import { MapHeader } from '@/features/village-map/map-header';

/**
 * Placeholder while the map pins load from the API. It reserves the final layout below the header: the
 * same container, a filter row of the same height, and the same map frame height (`VillageMapExplorer`),
 * so the footer starts below the fold in both states and nothing visible moves when the page swaps in.
 */
export default function Loading() {
  return (
    <div className="mx-auto max-w-editorial px-gutter pt-12 pb-section-tail">
      <MapHeader />
      <LoadingStatus className="mt-8 flex flex-col gap-6">
        {/* The filter row wraps to about three lines on a phone, one on a wide screen. */}
        <Skeleton className="h-28 w-full rounded-input md:h-10" />
        <div className="grid gap-6 lg:grid-cols-[3fr_2fr] lg:items-start">
          <Skeleton className="h-[65svh] min-h-80 w-full rounded-card lg:h-[75svh]" />
          <div className="flex flex-col gap-4">
            <Skeleton className="h-7 w-2/3" />
            {Array.from({ length: 4 }, (_, index) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: identical placeholders, never reordered.
              <Skeleton key={index} className="h-24 w-full rounded-card" />
            ))}
          </div>
        </div>
      </LoadingStatus>
    </div>
  );
}
