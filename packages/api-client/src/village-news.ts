import { NewsDetailResponseSchema, NewsListResponseSchema } from '@vcraft/contracts';
import { type AuthedClientOptions, createAuthedRequest } from './http/authed-request';

/** News that only approved households and administrators can read (FR-NEWS-02). */
export function createVillageNewsClient(options: AuthedClientOptions) {
  const request = createAuthedRequest(options);
  return {
    list: () => request('/news/village', NewsListResponseSchema),
    get: (slug: string) =>
      request(`/news/village/${encodeURIComponent(slug)}`, NewsDetailResponseSchema),
  };
}
export type VillageNewsClient = ReturnType<typeof createVillageNewsClient>;
