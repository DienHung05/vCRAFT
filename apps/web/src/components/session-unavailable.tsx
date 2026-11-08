import { useTranslations } from 'next-intl';
import { RetryLink } from './retry-link';

/**
 * Inline state a guarded layout renders when the API could not say who is signed in (slow, rate limited,
 * HTML challenge page). It replaces the old thrown error, so the document stays HTTP 200 inside the normal
 * page shell. "Try again" re-renders the route on the server, which asks the API once more.
 */
export function SessionUnavailable() {
  const t = useTranslations('auth.serviceDown');
  return (
    <section
      role="alert"
      className="mx-auto flex max-w-prose-vn flex-col items-center gap-5 px-gutter py-section text-center"
    >
      <h1>{t('title')}</h1>
      <p className="text-ash">{t('lead')}</p>
      <RetryLink />
    </section>
  );
}
