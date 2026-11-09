import { describe, expect, it } from 'vitest';
import { createAdminClient } from '../src';

const householdId = '123e4567-e89b-12d3-a456-426614174000';

describe('admin household list', () => {
  it('sends filters with the cursor and limit, and parses the cursor page', async () => {
    const urls: string[] = [];
    const client = createAdminClient({
      getAccessToken: async () => 'session-token',
      fetch: async (url) => {
        urls.push(url);
        return Response.json({
          data: [
            {
              id: householdId,
              version: 1,
              name: 'Gốm Minh Hải',
              status: 'APPROVED',
              reviewState: 'NEW',
              resubmittedAt: null,
              submittedAt: '2026-10-01T00:00:00.000Z',
            },
          ],
          nextCursor: 'abc',
        });
      },
    });

    const page = await client.listHouseholds({ status: 'APPROVED', cursor: 'prev', limit: 50 });

    const query = new URL(urls[0] ?? '', 'https://vcraft.test').searchParams;
    expect(query.get('status')).toBe('APPROVED');
    expect(query.get('cursor')).toBe('prev');
    expect(query.get('limit')).toBe('50');
    expect(page.nextCursor).toBe('abc');
    expect(page.data[0]?.name).toBe('Gốm Minh Hải');
  });
});
