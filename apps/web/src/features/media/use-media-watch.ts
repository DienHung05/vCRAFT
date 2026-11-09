'use client';

import type { MediaAssetResponse, MediaVariantResponse } from '@vcraft/contracts';
import { useEffect, useRef } from 'react';
import { useLiveEvents } from '@/lib/api/live-events';

/** A photo that finished processing, as the live event or `GET /media/:id` reports it. */
export interface MediaUpdate {
  id: string;
  status: 'READY' | 'FAILED';
  /** The ~1280 px WebP; null unless `READY`. */
  url: string | null;
  variants: readonly MediaVariantResponse[];
  thumbhash: string | null;
}

/** Polling fallback (GH#252): ask every 5 s, give up after 5 min. */
export const MEDIA_POLL_MS = 5_000;
export const MEDIA_POLL_GIVE_UP_MS = 5 * 60_000;
/** While the live stream is up, polling is only a safety net for an event lost between reconnects. */
export const MEDIA_POLL_LIVE_MS = 15_000;

/** The ~1280 px WebP of a processed photo, as the API's `url` for it. */
export function displayUrlOf(variants: readonly MediaVariantResponse[]): string | null {
  const webp = variants.filter((variant) => variant.format === 'webp');
  const best = [...webp].sort((a, b) => Math.abs(a.width - 1280) - Math.abs(b.width - 1280))[0];
  return best?.url ?? null;
}

export function updateFromAsset(asset: MediaAssetResponse): MediaUpdate | null {
  if (asset.status === 'PROCESSING') return null;
  return {
    id: asset.id,
    status: asset.status,
    url: asset.status === 'READY' ? displayUrlOf(asset.variants) : null,
    variants: asset.status === 'READY' ? asset.variants : [],
    thumbhash: asset.thumbhash,
  };
}

/**
 * Follows photos that are still processing. The `media.updated` event on `GET /me/events` updates them as soon
 * as the worker finishes; when the stream is down, or as a safety net, `getMedia` is polled every 5 s for up to
 * 5 min. `onUpdate` runs once per photo that turned `READY` or `FAILED`.
 */
export function useMediaWatch(
  pendingIds: readonly string[],
  getMedia: (id: string) => Promise<MediaAssetResponse>,
  onUpdate: (update: MediaUpdate) => void,
): void {
  const handler = useRef(onUpdate);
  handler.current = onUpdate;
  const fetcher = useRef(getMedia);
  fetcher.current = getMedia;
  const pending = useRef(new Set<string>());
  const startedAt = useRef(new Map<string, number>());
  const live = useRef(false);

  const key = [...new Set(pendingIds)].sort().join(',');
  useEffect(() => {
    const ids = new Set(key ? key.split(',') : []);
    pending.current = ids;
    for (const id of ids) if (!startedAt.current.has(id)) startedAt.current.set(id, Date.now());
    for (const id of startedAt.current.keys()) if (!ids.has(id)) startedAt.current.delete(id);
    if (ids.size === 0) return;

    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let lastPoll = 0;
    const poll = async () => {
      lastPoll = Date.now();
      for (const id of [...pending.current]) {
        if (Date.now() - (startedAt.current.get(id) ?? Date.now()) > MEDIA_POLL_GIVE_UP_MS) {
          pending.current.delete(id);
          continue;
        }
        try {
          const update = updateFromAsset(await fetcher.current(id));
          if (update && !stopped && pending.current.delete(id)) handler.current(update);
        } catch {
          // The next tick asks again.
        }
      }
    };
    const tick = () => {
      if (stopped || pending.current.size === 0) return;
      const every = live.current ? MEDIA_POLL_LIVE_MS : MEDIA_POLL_MS;
      if (Date.now() - lastPoll >= every) void poll();
      timer = setTimeout(tick, MEDIA_POLL_MS);
    };
    void poll();
    timer = setTimeout(tick, MEDIA_POLL_MS);
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
    };
  }, [key]);

  const status = useLiveEvents((event) => {
    if (event.type !== 'media.updated' || !pending.current.delete(event.id)) return;
    handler.current({
      id: event.id,
      status: event.status,
      url: event.url,
      variants: event.variants,
      thumbhash: event.thumbhash,
    });
  });
  live.current = status === 'live';
}
