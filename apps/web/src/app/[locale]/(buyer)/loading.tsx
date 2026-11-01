import { ListSkeleton } from '@/components/states/skeletons';

/** Placeholder while a buyer page resolves its session on the server. */
export default function Loading() {
  return <ListSkeleton />;
}
