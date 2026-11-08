'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { favouritesStore } from './favourites-store';

/** The shared favourites list (see `FavouritesStore`); mounting it settles guest or account mode once. */
export function useFavourites() {
  const snapshot = useSyncExternalStore(
    favouritesStore.subscribe,
    favouritesStore.getSnapshot,
    favouritesStore.getServerSnapshot,
  );
  useEffect(() => {
    favouritesStore.ensure();
  }, []);
  return {
    ids: snapshot.ids,
    ready: snapshot.ready,
    mode: snapshot.mode,
    toggle: favouritesStore.toggle,
  };
}
