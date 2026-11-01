import { DashboardSkeleton } from '@/components/states/skeletons';

/** Placeholder while an Admin page resolves its session (the layout adds the padding). */
export default function Loading() {
  return <DashboardSkeleton className="mx-auto max-w-6xl" />;
}
