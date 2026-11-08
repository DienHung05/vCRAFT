'use client';

import { createPaymentClient, type PaymentClient } from '@vcraft/api-client';
import { useLiveClient } from './live-session';

/** The session client of the payment screens; tests pass `provided`. Without a session `client` is `null`. */
export function usePaymentClient(provided?: PaymentClient) {
  return useLiveClient(provided, (getAccessToken) => createPaymentClient({ getAccessToken }));
}
