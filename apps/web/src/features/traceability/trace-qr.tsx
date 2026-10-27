'use client';

import { useEffect, useRef } from 'react';

export interface TraceQrProps {
  /** URL ngắn mã hóa trong QR (FR-TRC-02: `https://<domain>/q/<code>`). */
  url: string;
  size: number;
}

/**
 * QR có thương hiệu (FR-TRC-02): chấm bo tròn màu mực, mức sửa lỗi H, nền trong suốt để
 * khung triện và men rạn phía sau lộ ra. Màu đọc từ token lúc chạy nên theo cả chế độ tối.
 */
export function TraceQr({ url, size }: TraceQrProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let cancelled = false;
    void import('qr-code-styling').then(({ default: QRCodeStyling }) => {
      if (cancelled) return;
      const ink = getComputedStyle(el).getPropertyValue('--color-ink').trim() || '#1c1814';
      const seal = getComputedStyle(el).getPropertyValue('--color-seal').trim() || '#c2261c';
      const qr = new QRCodeStyling({
        width: size,
        height: size,
        type: 'svg',
        data: url,
        margin: 0,
        qrOptions: { errorCorrectionLevel: 'H' },
        dotsOptions: { type: 'rounded', color: ink },
        cornersSquareOptions: { type: 'extra-rounded', color: seal },
        cornersDotOptions: { color: seal },
        backgroundOptions: { color: 'transparent' },
      });
      el.replaceChildren();
      qr.append(el);
    });
    return () => {
      cancelled = true;
    };
  }, [url, size]);

  return <div ref={ref} aria-hidden="true" style={{ width: size, height: size }} />;
}
