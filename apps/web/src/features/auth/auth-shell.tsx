import type { ReactNode } from 'react';
import { Reveal } from '@/experience/motion/reveal';
import { KilnShell } from './kiln/kiln-shell';

/**
 * Shared frame of the account pages: a full-bleed kiln scene with the glowing trace seal, and a glazed card
 * holding the title, the lead and the page content (see `kiln/`). The props are unchanged so the pages
 * keep calling it as before.
 */
export function AuthShell({
  title,
  lead,
  children,
  wide = false,
}: {
  title: ReactNode;
  lead?: ReactNode;
  children: ReactNode;
  /** Wider card for the multi-step wizard. */
  wide?: boolean;
}) {
  return (
    <KilnShell
      wide={wide}
      header={
        <>
          <h1 className="text-h2 font-semibold text-glaze">{title}</h1>
          {lead ? <p className="text-body text-ash">{lead}</p> : null}
        </>
      }
    >
      <Reveal>{children}</Reveal>
    </KilnShell>
  );
}
