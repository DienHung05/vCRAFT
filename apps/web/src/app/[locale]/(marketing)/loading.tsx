import { BannerSkeleton } from '@/components/states/skeletons';

/** Placeholder while the home page sections load from the API. */
export default function Loading() {
  return <BannerSkeleton className="mx-auto max-w-editorial px-gutter pt-16 pb-section" />;
}
