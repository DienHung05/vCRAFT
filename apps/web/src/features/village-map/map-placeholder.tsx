'use client';

import { Button } from '@vcraft/ui';
import { useTranslations } from 'next-intl';

/**
 * Stands in for the map until MapLibre is started (GH#481). It fills the map frame, whose size is fixed by the
 * frame's own classes, so the map replacing it shifts nothing. The button starts the map at once.
 */
export function MapPlaceholder({ onStart }: { onStart: () => void }) {
  const t = useTranslations('villageMap');
  return (
    <div
      data-testid="map-placeholder"
      className="grid size-full place-content-center justify-items-center gap-3 bg-paper p-6 text-center"
    >
      <p className="max-w-xs text-small text-ash">{t('mapPlaceholder')}</p>
      <Button type="button" variant="secondary" onClick={onStart}>
        {t('loadMap')}
      </Button>
    </div>
  );
}
