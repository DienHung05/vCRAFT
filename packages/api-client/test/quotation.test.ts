import { describe, expect, it } from 'vitest';
import { createQuotationClient, QuotationApiError } from '../src';

const requestId = '123e4567-e89b-12d3-a456-426614174000';

describe('quotation HTTP client', () => {
  it('sends the request version and current access token with a manual quotation', async () => {
    let observed: Request | undefined;
    const client = createQuotationClient({
      getAccessToken: async () => 'session-token',
      fetch: async (url, options) => {
        observed = new Request(`https://vcraft.test${url}`, options);
        return Response.json({
          id: requestId,
          version: 1,
          status: 'SUBMITTED',
          quantity: 2000,
          parts: [
            {
              householdId: requestId,
              householdName: 'Gốm Minh Hải',
              quantity: 2000,
              unitPriceVnd: 30_000,
              completionDate: '2027-02-01T00:00:00.000Z',
              contributionVersion: 4,
            },
          ],
          productionTotalVnd: 60_000_000,
          additionalChargeVnd: 0,
          totalVnd: 60_000_000,
          deliveryTerms: 'SEPARATE',
        });
      },
    });
    await client.submitQuotation(requestId, 7, {
      parts: [
        {
          householdId: requestId,
          quantity: 2000,
          unitPriceVnd: 30_000,
          completionDate: '2027-02-01T00:00:00.000Z',
          contributionVersion: 4,
        },
      ],
      additionalChargeVnd: 0,
      deliveryTerms: 'SEPARATE',
    });
    expect(observed?.method).toBe('POST');
    expect(observed?.headers.get('authorization')).toBe('Bearer session-token');
    expect(observed?.headers.get('if-match')).toBe('"7"');
    expect(observed?.url).toBe(`https://vcraft.test/api/v1/rfqs/${requestId}/quotations`);
  });

  it('returns the API problem code so a stale plan can be refreshed', async () => {
    const client = createQuotationClient({
      getAccessToken: async () => 'session-token',
      fetch: async () =>
        Response.json(
          {
            type: '/problems/stale-version',
            title: 'Stale version',
            status: 409,
            code: 'STALE_VERSION',
          },
          { status: 409 },
        ),
    });
    await expect(client.getRequest(requestId)).rejects.toMatchObject({
      code: 'STALE_VERSION',
      status: 409,
    });
  });

  it('requires a session before sending private HTTP requests', async () => {
    const client = createQuotationClient({
      getAccessToken: async () => null,
      fetch: async () => {
        throw new Error('must not send');
      },
    });
    await expect(client.getRequest(requestId)).rejects.toBeInstanceOf(QuotationApiError);
    await expect(client.getRequest(requestId)).rejects.toMatchObject({
      code: 'AUTH_UNAUTHENTICATED',
    });
  });

  it('marks one notice and all notices read with POST requests', async () => {
    const seen: Array<{ method: string; url: string }> = [];
    const client = createQuotationClient({
      getAccessToken: async () => 'session-token',
      fetch: async (url, options) => {
        seen.push({ method: options.method ?? 'GET', url });
        return url.endsWith('/read-all')
          ? Response.json({ updated: 3 })
          : Response.json({
              id: requestId,
              version: 2,
              kind: 'ORDER_CANCELLED',
              requestId,
              quotationId: null,
              createdAt: '2027-02-01T00:00:00.000Z',
              readAt: '2027-02-01T01:00:00.000Z',
            });
      },
    });
    const notice = await client.markNoticeRead(requestId);
    expect(notice.readAt).toBe('2027-02-01T01:00:00.000Z');
    expect(await client.markAllNoticesRead()).toEqual({ updated: 3 });
    expect(seen).toEqual([
      { method: 'POST', url: `/api/v1/me/quotation-notices/${requestId}/read` },
      { method: 'POST', url: '/api/v1/me/quotation-notices/read-all' },
    ]);
  });
});
it('normalizes gateway errors even when the response is HTML', async () => {
  const client = createQuotationClient({
    getAccessToken: async () => 'session-token',
    fetch: async () => new Response('<html>Unavailable</html>', { status: 502 }),
  });
  await expect(client.getRequest(requestId)).rejects.toMatchObject({
    code: 'INTERNAL_ERROR',
    status: 502,
  });
});
