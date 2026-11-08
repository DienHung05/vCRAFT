'use client';

import { UsernameSchema } from '@vcraft/contracts';
import { isReservedUsername } from '@vcraft/domain';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { usernameAvailable } from './public-auth';

export function UsernameAvailability({ username }: { username: string }) {
  const t = useTranslations('auth.username');
  const [state, setState] = useState<'idle' | 'checking' | 'available' | 'taken' | 'unavailable'>(
    'idle',
  );
  useEffect(() => {
    const value = username.trim().toLowerCase();
    if (!UsernameSchema.safeParse(value).success || isReservedUsername(value))
      return setState('idle');
    const controller = new AbortController();
    setState('checking');
    const timer = setTimeout(() => {
      usernameAvailable(value, controller.signal)
        .then((available) => {
          if (!controller.signal.aborted) setState(available ? 'available' : 'taken');
        })
        .catch(() => {
          if (!controller.signal.aborted) setState('unavailable');
        });
    }, 350);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [username]);
  if (state === 'idle') return null;
  return (
    <p className={state === 'taken' ? 'text-small text-seal' : 'text-small text-ash'} role="status">
      {t(state)}
    </p>
  );
}
