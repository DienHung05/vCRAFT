import { toast } from 'sonner';

/**
 * Result of a user action (saved, submitted, approved, deleted, uploaded…) as a toast. Always pass
 * an already translated sentence. Safe to call where no `<Toaster />` is mounted (tests, error
 * boundaries): the call is then a no-op. Failures that need the user to fix something should
 * still keep an inline message next to the field; the toast is for the outcome.
 */
export const notify = {
  success: (message: string) => toast.success(message),
  error: (message: string) => toast.error(message),
  info: (message: string) => toast(message),
};
