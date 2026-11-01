import { FormSkeleton } from '@/components/states/skeletons';

/** Placeholder for the sign-in family of pages while the server resolves the session. */
export default function Loading() {
  return <FormSkeleton fields={2} className="mx-auto max-w-xl px-gutter pt-12 pb-section" />;
}
