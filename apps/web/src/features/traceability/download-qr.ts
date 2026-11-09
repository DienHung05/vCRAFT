import { QR_LOGO_OPTIONS, QR_LOGO_URL } from './trace-qr';

/** Downloads a print-size QR as PNG or SVG (FR-TRC-02); the drawing library loads only on click. */
export async function downloadQr(url: string, code: string, extension: 'png' | 'svg') {
  const { default: QRCodeStyling } = await import('qr-code-styling');
  const qr = new QRCodeStyling({
    width: 1024,
    height: 1024,
    type: extension === 'svg' ? 'svg' : 'canvas',
    data: url,
    image: QR_LOGO_URL,
    imageOptions: QR_LOGO_OPTIONS,
    margin: 32,
    qrOptions: { errorCorrectionLevel: 'H' },
    dotsOptions: { type: 'rounded', color: '#1c1814' },
    cornersSquareOptions: { type: 'extra-rounded', color: '#c2261f' },
    cornersDotOptions: { color: '#c2261f' },
    backgroundOptions: { color: '#ffffff' },
  });
  await qr.download({ name: `vcraft-qr-${code}`, extension });
}
