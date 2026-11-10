import { type MapBbox, type MapPinsDto, MapPinsResponseSchema } from '@vcraft/contracts';
import { ApiError } from './http/authed-request';
import { fallbackErrorCode } from './http/fallback-error-code';

export interface MapClientOptions {
  fetch?: (url: string, init: RequestInit) => Promise<Response>;
}

/** Public village map: no session needed (FR-MAP-04). */
export function createMapClient(options: MapClientOptions = {}) {
  const fetcher = options.fetch ?? globalThis.fetch.bind(globalThis);
  return {
    /** Pins inside a viewport; `signal` cancels a request a newer pan made stale. */
    pinsInBbox: async (bbox: MapBbox, signal?: AbortSignal): Promise<MapPinsDto> => {
      const value = [bbox.minLng, bbox.minLat, bbox.maxLng, bbox.maxLat]
        .map((n) => n.toFixed(6))
        .join(',');
      const response = await fetcher(`/api/v1/map/workshops?bbox=${encodeURIComponent(value)}`, {
        headers: { accept: 'application/json' },
        ...(signal ? { signal } : {}),
      });
      if (!response.ok) throw new ApiError(fallbackErrorCode(response.status), response.status);
      return MapPinsResponseSchema.parse(await response.json());
    },
  };
}
export type MapClient = ReturnType<typeof createMapClient>;
