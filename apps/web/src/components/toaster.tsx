'use client';

import { useTranslations } from 'next-intl';
import { Toaster as Sonner } from 'sonner';

/**
 * Mounts the toast region once, in the locale layout. The region is an `aria-live="polite"`
 * landmark (sonner), so a result announced here is read without stealing focus. Toasts are
 * styled with the brand tokens instead of sonner's defaults and stay put under reduced motion
 * (sonner honours `prefers-reduced-motion` for its transitions).
 */
export function Toaster() {
  const t = useTranslations('common');
  return (
    <Sonner
      position="bottom-center"
      duration={5000}
      closeButton
      containerAriaLabel={t('notifications')}
      mobileOffset={{ bottom: '5.5rem', left: '1rem', right: '1rem' }}
      offset={{ bottom: '1.5rem' }}
      toastOptions={{
        unstyled: true,
        closeButtonAriaLabel: t('dismiss'),
        classNames: {
          toast:
            'flex w-full items-start gap-3 rounded-card bg-surface p-4 text-small text-ink shadow-warm ring-1 ring-ink/10 md:w-[22rem]',
          title: 'font-medium',
          description: 'text-ash',
          success: 'border-l-4 border-celadon',
          error: 'border-l-4 border-seal',
          closeButton:
            'absolute top-2 right-2 grid size-6 place-items-center rounded-input text-ash hover:bg-ink/8 hover:text-ink',
        },
      }}
    />
  );
}
