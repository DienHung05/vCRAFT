import { ArticleSkeleton } from '@/components/states/skeletons';

/** Placeholder while the trace record loads after a QR scan. */
export default function Loading() {
  return <ArticleSkeleton className="max-w-xl" />;
}
