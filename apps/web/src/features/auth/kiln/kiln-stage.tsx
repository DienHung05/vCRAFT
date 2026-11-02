import type { ReactNode } from 'react';
import { KilnEffects } from './kiln-effects';
import { KilnScene } from './kiln-scene';
import './kiln.css';

/**
 * The kiln scene itself: the full-bleed backdrop (glow, shimmer, embers, grain) and the lazy WebGL island.
 * It is rendered once by `app/[locale]/(auth)/layout.tsx`, so it persists across soft navigations between
 * the account pages (and between the loading shell and the page); each page brings only its seal column and
 * card (`KilnShell`). The pages mount inside it as children of the scene.
 */
export function KilnStage({ children }: { children: ReactNode }) {
  return (
    <div className="kiln-scene">
      <KilnScene />
      <KilnEffects />
      {children}
    </div>
  );
}
