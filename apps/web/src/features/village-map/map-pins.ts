import { type MapPinDto, MapPinsResponseSchema } from '@vcraft/contracts';
import { EXHIBITION_TAG } from '@vcraft/utils';
import { fetchPublicJson } from '@/lib/api/fetch-public-json';

/**
 * Server-side fetch of the map pins. Kept apart from `map-model.ts` (which client components import) so
 * the zod schema and the API client stay out of the map page's client bundle.
 */
export type MapPinsResult = { status: 'ok'; pins: MapPinDto[] } | { status: 'unavailable' };

/** Ghim xưởng từ `GET /map/workshops`; API tắt hoặc trả sai dạng thì trang hiện lỗi kèm thử lại. */
export async function fetchMapPins(): Promise<MapPinsResult> {
  const result = await fetchPublicJson('/map/workshops', MapPinsResponseSchema, {
    revalidate: 30,
    tags: [EXHIBITION_TAG],
  });
  return result.status === 'ok'
    ? { status: 'ok', pins: result.data.data }
    : { status: 'unavailable' };
}
