'use client';

import { type AdministrativeUnit, suggestAddresses } from '@vcraft/utils';
import { useEffect, useMemo, useState } from 'react';

/*
 * Province and ward/commune names after the July 2025 reorganisation (34 provinces, two levels), from the
 * General Statistics Office list as published by provinces.open-api.vn (`/api/v2/?depth=2`, fetched
 * 3 Nov 2026). ~65 KB, so it is loaded on the first keystroke into an address field, in its own chunk.
 */
let units: Promise<readonly AdministrativeUnit[]> | null = null;
function loadUnits() {
  units ??= import('./vn-administrative-units.json').then(
    (module) => module.default as unknown as readonly AdministrativeUnit[],
  );
  return units;
}

/**
 * `<datalist>` options completing the ward and province of an address as it is typed. Before the list
 * has loaded (or if it fails to) there are no suggestions and the field works as plain text.
 */
export function useAddressSuggestions(value: string): string[] {
  const [loaded, setLoaded] = useState<readonly AdministrativeUnit[] | null>(null);
  useEffect(() => {
    if (loaded || value.trim().length < 2) return;
    let live = true;
    loadUnits().then(
      (list) => {
        if (live) setLoaded(list);
      },
      () => {
        units = null;
      },
    );
    return () => {
      live = false;
    };
  }, [loaded, value]);
  return useMemo(() => (loaded ? suggestAddresses(value, loaded) : []), [loaded, value]);
}
