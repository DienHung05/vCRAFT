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
  heading,
}: {
  className?: string;
  /** More specific text than the generic "could not load". */
  message?: string;
  /** Page title for a detail page that has nothing else to render, so the document keeps an h1. */
  heading?: string;
}) {
  const block = (
    <ErrorState
      message={message}
      action={<RetryLink />}
      className={className ?? 'mx-auto max-w-editorial px-gutter py-section'}
    />
  );
  if (!heading) return block;
  return (
    <div className="mx-auto max-w-editorial px-gutter py-section">
      <h1 className="mb-4">{heading}</h1>
      {block}
    </div>
  );
}
