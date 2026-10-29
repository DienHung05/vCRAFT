'use client';

import type { QuotationClient } from '@vcraft/api-client';
import { useEffect, useState } from 'react';

/** Only browser components create the session client; server pages pass serializable IDs. */
export function useQuotationClient(provided?: QuotationClient) {
  const [client, setClient] = useState<QuotationClient | null>(provided ?? null);
  const [loading, setLoading] = useState(provided === undefined);
  useEffect(() => {
    if (provided) {
      setClient(provided);
      setLoading(false);
      return;
    }
    let active = true;
    void import('./quotation-live')
      .then(({ liveQuotationClient }) => {
        if (active) setClient(liveQuotationClient());
      })
      .catch(() => {
        if (active) setClient(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [provided]);
  return { client, loading };
}
