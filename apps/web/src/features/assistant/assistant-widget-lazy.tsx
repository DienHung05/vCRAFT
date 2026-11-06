'use client';

import dynamic from 'next/dynamic';

/**
 * The Fox assistant for public pages, loaded after hydration (`ssr: false`) so its code, the mascot and
 * the bottom sheet stay out of every route's first-load JS budget.
 */
export const LazyAssistantWidget = dynamic(
  () => import('./assistant-widget').then((m) => m.AssistantWidget),
  { ssr: false },
);
