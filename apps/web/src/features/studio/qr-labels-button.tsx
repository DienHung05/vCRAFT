'use client';

import type { StudioClient } from '@vcraft/api-client';
import { Button } from '@vcraft/ui';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';

// The worker usually finishes in a second or two; give up politely after ~1 minute.
const POLL_EVERY_MS = 1_500;
const POLL_ATTEMPTS = 40;

type State = 'idle' | 'busy' | 'failed' | 'timeout';

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Asks the worker for an A4 sheet of QR labels (PLAN E6) and opens the PDF when it is ready. The sheet
 * holds `copies` labels for each product, in the order given.
 */
export function QrLabelsButton({
  client,
  productIds,
  label,
  copies = 1,
}: {
  client: Pick<StudioClient, 'requestQrLabels' | 'qrLabelsStatus'>;
  productIds: readonly string[];
  label: string;
  copies?: number;
}) {
  const t = useTranslations('studio.products.labels');
  const [state, setState] = useState<State>('idle');
  // Bumped on unmount (and on every new run) so an old polling loop stops instead of acting late.
  const runId = useRef(0);
  useEffect(() => {
    return () => {
      runId.current += 1;
    };
  }, []);

  const run = async () => {
    const id = ++runId.current;
    const live = () => id === runId.current;
    setState('busy');
    try {
      const { requestId } = await client.requestQrLabels({ productIds: [...productIds], copies });
      for (let attempt = 0; attempt < POLL_ATTEMPTS; attempt++) {
        if (!live()) return;
        await wait(POLL_EVERY_MS);
        if (!live()) return;
        const status = await client.qrLabelsStatus(requestId);
        if (!live()) return;
        if (status.status === 'READY' && status.url) {
          // A new tab keeps this page (and its selection) in place.
          window.open(status.url, '_blank', 'noopener');
          setState('idle');
          return;
        }
      }
      setState('timeout');
    } catch {
      if (live()) setState('failed');
    }
  };

  return (
    <span className="flex flex-col items-start gap-1">
      <Button
        type="button"
        variant="secondary"
        // Long labels ("Nhãn QR cho 9 sản phẩm…") wrap on a 360 px phone (GH#257).
        className="h-auto min-h-11 whitespace-normal py-2 text-left"
        disabled={state === 'busy' || productIds.length === 0}
        onClick={() => void run()}
      >
        {state === 'busy' ? t('preparing') : label}
      </Button>
      {state === 'failed' || state === 'timeout' ? (
        <span role="alert" className="text-small text-seal">
          {t(state)}
        </span>
      ) : (
        <span className="text-small text-ash">{t('hint')}</span>
      )}
    </span>
  );
}
