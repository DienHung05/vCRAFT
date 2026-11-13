import { Skeleton } from '@vcraft/ui';
import { LoadingStatus } from '@/components/states/skeletons';
import { MapHeader } from '@/features/village-map/map-header';

/** Placeholder while the map pins load from the API; the header text is already final (GH#481). */
export default function Loading() {
  return (
    <div className="mx-auto max-w-editorial px-gutter pt-12 pb-section-tail">
      <MapHeader />
      <LoadingStatus className="mt-8">
        <Skeleton className="h-72 w-full rounded-card md:h-96" />
      </LoadingStatus>
    </div>
  );
}
