// The list keeps its skeleton in a route group, so an unknown household slug answers a real 404 (GH#256).
import { CardGridSkeleton } from '@/components/states/skeletons';

/** Placeholder while the household list loads from the API. */
export default function Loading() {
  return <CardGridSkeleton />;
}
