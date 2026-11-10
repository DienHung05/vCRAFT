// The list keeps its skeleton in a route group, so an unknown household slug answers a real 404 (GH#256).
import { CardGridSkeleton } from '@/components/states/skeletons';

/** Placeholder while the household list loads: same four-column, 4:3 cards the page renders. */
export default function Loading() {
  return (
    <CardGridSkeleton
      ratio="4/3"
      gridClassName="grid grid-cols-2 gap-x-5 gap-y-8 md:grid-cols-3 md:gap-x-6 lg:grid-cols-4"
    />
  );
}
