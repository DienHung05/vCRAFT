import { type MapPinDto, MapPinsResponseSchema } from '@vcraft/contracts';
import { apiBaseUrl } from '@/features/news/news-api';

/**
 * Server-side fetch of the map pins. Kept apart from `map-model.ts` (which client components import) so
 * the zod schema and the API client stay out of the map page's client bundle.
 */
export type MapPinsResult = { status: 'ok'; pins: MapPinDto[] } | { status: 'unavailable' };

/** Ghim xưởng từ `GET /map/workshops`; API tắt hoặc trả sai dạng thì trang hiện lỗi kèm thử lại. */
export async function fetchMapPins(): Promise<MapPinsResult> {
  try {
    const res = await fetch(`${apiBaseUrl()}/map/workshops`, {
      headers: { accept: 'application/json' },
      next: { revalidate: 30 },
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return { status: 'unavailable' };
    const parsed = MapPinsResponseSchema.safeParse(await res.json());
    return parsed.success ? { status: 'ok', pins: parsed.data.data } : { status: 'unavailable' };
  } catch {
    return { status: 'unavailable' };
  }
}
