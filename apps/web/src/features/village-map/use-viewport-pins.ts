'use client';

import type { MapBbox, MapPinDto } from '@vcraft/contracts';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { MapBounds } from './map-model';

export const VIEWPORT_DEBOUNCE_MS = 300;

export type FetchViewportPins = (
  bbox: MapBbox,
  signal: AbortSignal,
) => Promise<readonly MapPinDto[]>;

/**
 * Pins of the viewport after the map stops moving (FR-MAP-04). A new move restarts the debounce and
 * aborts the request still in flight, so a stale answer never replaces a newer one. `pins` stays null
 * until the first viewport answer, so the server-rendered data is used until then.
 */
export function useViewportPins(fetchPins: FetchViewportPins, delayMs = VIEWPORT_DEBOUNCE_MS) {
  const [pins, setPins] = useState<readonly MapPinDto[] | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const controller = useRef<AbortController | null>(null);
  const fetchRef = useRef(fetchPins);
  fetchRef.current = fetchPins;

  const cancel = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    controller.current?.abort();
    controller.current = null;
  }, []);

  const schedule = useCallback(
    (bounds: MapBounds) => {
      cancel();
      timer.current = setTimeout(() => {
        timer.current = null;
        const own = new AbortController();
        controller.current = own;
        fetchRef
          .current(
            {
              minLng: bounds.west,
              minLat: bounds.south,
              maxLng: bounds.east,
              maxLat: bounds.north,
            },
            own.signal,
          )
          .then((result) => {
            if (!own.signal.aborted) setPins(result);
          })
          // A failed or cancelled request keeps whatever the map already shows.
          .catch(() => undefined);
      }, delayMs);
    },
    [cancel, delayMs],
  );

  /** Back to the server-rendered full list. */
  const reset = useCallback(() => {
    cancel();
    setPins(null);
  }, [cancel]);

  useEffect(() => cancel, [cancel]);

  return { pins, schedule, reset };
}
