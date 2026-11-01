import { RetryLink } from './retry-link';
import { ErrorState } from './states/error-state';

/**
 * Block shown when a server-rendered data block could not load from the API, with a retry button
 * that reloads the route's data (distinct from a real 404). Client-loaded blocks use `ErrorState`
 * with their own `onRetry`.
 */
export function DataUnavailable({
  className,
  message,
}: {
  className?: string;
  /** More specific text than the generic "could not load". */
  message?: string;
}) {
  return (
    <ErrorState
      message={message}
      action={<RetryLink />}
      className={className ?? 'mx-auto max-w-editorial px-gutter py-section'}
    />
  );
}
