import type { ReactNode } from 'react';
import { LazyAssistantWidget } from '@/features/assistant/assistant-widget-lazy';

/**
 * The QR trace page draws its own header and footer-less landing, so it does not use `PublicShell`;
 * this layout only adds the floating Fox launcher (FR-AST-01) and leaves the page's chrome untouched.
 */
export default function TraceLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <LazyAssistantWidget />
    </>
  );
}
