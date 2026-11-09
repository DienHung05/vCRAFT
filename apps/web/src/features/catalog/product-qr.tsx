'use client';

import { Button, Card, TraceSealFrame } from '@vcraft/ui';
import { useTranslations } from 'next-intl';
import { downloadQr } from '@/features/traceability/download-qr';
import { TraceQr } from '@/features/traceability/trace-qr';

/**
 * QR of the product's trace page on the product page (FR-CAT-05): the same branded code as the label,
 * pointing at the short link `/q/<code>`, with a PNG download. `url` is that absolute short link.
 */
export function ProductQr({ code, url }: { code: string; url: string }) {
  const t = useTranslations('product.qr');
  return (
    <Card className="flex flex-col items-start gap-4 p-5 sm:flex-row sm:items-center">
      <TraceSealFrame code={code} size={140} title={t('label', { code })}>
        <TraceQr url={url} size={96} />
      </TraceSealFrame>
      <div className="flex flex-col items-start gap-2">
        <h2 className="font-sans text-body font-semibold text-ink">{t('title')}</h2>
        <p className="text-small text-ash">{t('lead')}</p>
        <p className="text-small text-ash">
          {t('link')}:{' '}
          <a href={url} className="font-mono text-clay underline underline-offset-4">
            {url.replace(/^https?:\/\//, '')}
          </a>
        </p>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => void downloadQr(url, code, 'png')}
        >
          {t('download')}
        </Button>
      </div>
    </Card>
  );
}
