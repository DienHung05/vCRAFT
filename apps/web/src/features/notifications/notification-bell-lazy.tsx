'use client';

import dynamic from 'next/dynamic';

/** Bell for the public header, loaded after hydration (`ssr: false`): guests never see it. */
export const LazyNotificationBell = dynamic(
  () => import('./notification-bell').then((m) => m.NotificationBell),
  { ssr: false },
);
