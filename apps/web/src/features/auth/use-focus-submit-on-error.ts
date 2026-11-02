import { useEffect, useRef } from 'react';

/**
 * After a server or auth error the submit button was disabled while the request ran, so the browser dropped
 * the focus. Once the form is idle again, put the focus back on the submit button (the next thing the person
 * will do), unless they already moved it somewhere. Attach the returned ref to the `<form>`.
 * Client-side validation errors do not need this: react-hook-form focuses the first invalid field itself.
 */
export function useFocusSubmitOnError(error: unknown, submitting: boolean) {
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (!error || submitting) return;
    const active = document.activeElement;
    if (active && active !== document.body) return;
    form.current?.querySelector<HTMLButtonElement>('button[type="submit"]:not(:disabled)')?.focus();
  }, [error, submitting]);
  return form;
}
