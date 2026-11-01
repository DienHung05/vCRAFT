import { FormSkeleton } from '@/components/states/skeletons';

/** Placeholder while the account page resolves the viewer on the server. */
export default function Loading() {
  return <FormSkeleton className="mx-auto max-w-3xl px-gutter pt-10 pb-section" />;
}
