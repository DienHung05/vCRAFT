'use client';

import type { StyleSpecification } from 'maplibre-gl';
import { useCallback, useEffect, useState } from 'react';
import {
  chooseMapStyle,
  isTileServerError,
  ONLINE_STYLE_URL,
  offlineStyle,
  PMTILES_URL,
} from './offline-style';

interface MapStyleState {
  style: string | StyleSpecification;
  offline: boolean;
}

/**
 * Which style the village map draws (GH#100). Without a PMTiles extract it is always OpenFreeMap. With
 * one, the online style is probed first (2.5 s at most) and the map also switches over if the tile
 * server starts failing mid-visit. `style` is null while the probe runs.
 */
export function useMapStyle(): {
  style: string | StyleSpecification | null;
  offline: boolean;
  onMapError: (event: { error?: unknown }) => void;
} {
  const [state, setState] = useState<MapStyleState | null>(() =>
    PMTILES_URL ? null : { style: ONLINE_STYLE_URL, offline: false },
  );

  useEffect(() => {
    if (!PMTILES_URL) return;
    let live = true;
    void chooseMapStyle({}).then((chosen) => {
      if (live) setState(chosen);
    });
    return () => {
      live = false;
    };
  }, []);

  const onMapError = useCallback((event: { error?: unknown }) => {
    if (!PMTILES_URL || !isTileServerError(event.error)) return;
    setState((current) =>
      current?.offline ? current : { style: offlineStyle(PMTILES_URL), offline: true },
    );
  }, []);

  return { style: state?.style ?? null, offline: state?.offline ?? false, onMapError };
}
