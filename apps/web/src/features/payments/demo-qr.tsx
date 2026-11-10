'use client';

import { useEffect, useRef } from 'react';

/** Ink on white, whatever the theme: a scanner needs the contrast, so the code ignores dark mode. */
const QR_INK = '#1c1814';
const QR_PAPER = '#ffffff';

/**
 * The QR of a demo payment (ADR-0025), drawn in the browser from the link to our own confirm page. It never
 * encodes a bank or wallet payload. The drawing library loads on demand, so it stays out of the server render.
 */
export function DemoQr({ url, label, size = 220 }: { url: string; label: string; size?: number }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let cancelled = false;
    void import('qr-code-styling').then(({ default: QRCodeStyling }) => {
      if (cancelled) return;
      const qr = new QRCodeStyling({
        width: size,
        height: size,
        type: 'svg',
        data: url,
        margin: 0,
        qrOptions: { errorCorrectionLevel: 'M' },
        dotsOptions: { type: 'square', color: QR_INK },
        cornersSquareOptions: { type: 'square', color: QR_INK },
        cornersDotOptions: { type: 'square', color: QR_INK },
        backgroundOptions: { color: QR_PAPER },
      });
      el.replaceChildren();
      qr.append(el);
    });
    return () => {
      cancelled = true;
    };
  }, [url, size]);

  return (
    <div
      role="img"
      aria-label={label}
      data-testid="demo-qr"
      className="w-fit shrink-0 rounded-card border border-ink/10 bg-white p-3"
    >
      <div ref={ref} aria-hidden="true" style={{ width: size, height: size }} />
    </div>
  );
}
