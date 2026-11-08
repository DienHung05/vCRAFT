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

describe('direct quotation calls', () => {
  const direct = {
    id: requestId,
    version: 2,
    status: 'SUBMITTED',
    quantity: 100,
    unitPriceVnd: 30_000,
    totalVnd: 3_000_000,
    completionDate: '2027-02-01T00:00:00.000Z',
    note: null,
  };

  it('submits, revises and withdraws with the right verbs, paths and versions', async () => {
    const seen: Request[] = [];
    const client = createQuotationClient({
      getAccessToken: async () => 'session-token',
      fetch: async (url, options) => {
        seen.push(new Request(`https://vcraft.test${url}`, options));
        return Response.json(direct);
      },
    });
    const input = { unitPriceVnd: 30_000, completionDate: '2027-02-01T00:00:00.000Z' };
    await client.createDirectQuotation(requestId, input);
    await client.reviseDirectQuotation(requestId, 2, { ...input, note: 'faster' });
    await client.withdrawDirectQuotation(requestId, 3);
    expect(seen.map((r) => [r.method, new URL(r.url).pathname, r.headers.get('if-match')])).toEqual(
      [
        ['POST', `/api/v1/rfqs/${requestId}/direct-quotations`, null],
        ['PUT', `/api/v1/direct-quotations/${requestId}`, '"2"'],
        ['POST', `/api/v1/direct-quotations/${requestId}/withdraw`, '"3"'],
      ],
    );
  });

  it('refuses a free quotation before it leaves the browser', async () => {
    const client = createQuotationClient({
      getAccessToken: async () => 'session-token',
      fetch: async () => Response.json(direct),
    });
    expect(() =>
      client.createDirectQuotation(requestId, {
        unitPriceVnd: 0,
        completionDate: '2027-02-01T00:00:00.000Z',
      }),
    ).toThrow();
  });
});

describe('Idempotency-Key on state-changing RFQ calls (BR-L5)', () => {
  const rfq = {
    id: requestId,
    version: 2,
    revision: 0,
    status: 'DRAFT',
    title: 'Logo cups',
    category: null,
    budgetMinVnd: null,
    budgetMaxVnd: null,
    cancelReason: null,
    createdAt: '2027-02-01T00:00:00.000Z',
    design: '100 cups',
    quantity: 100,
    unit: 'cup',
    destination: 'Hanoi',
    requiredBy: '2027-03-01T00:00:00.000Z',
    biddingClosesAt: '2027-02-10T00:00:00.000Z',
    invitedHouseholdIds: [],
    coordinationOptIn: true,
  };
  const create = {
    title: 'Logo cups',
    design: '100 cups',
    quantity: 100,
    unit: 'cup',
    destination: 'Hanoi',
    requiredBy: '2027-03-01T00:00:00.000Z',
    biddingClosesAt: '2027-02-10T00:00:00.000Z',
    coordinationOptIn: true,
    invitedHouseholdIds: [],
    attachments: [],
  };
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

  function recordingClient() {
    const keys: Array<string | null> = [];
    const client = createQuotationClient({
      getAccessToken: async () => 'session-token',
      fetch: async (url, options) => {
        keys.push(new Request(`https://vcraft.test${url}`, options).headers.get('idempotency-key'));
        return Response.json(rfq);
      },
    });
    return { client, keys };
  }

  it('sends a fresh UUID with create, submit, accept, cancel and receive', async () => {
    const { client, keys } = recordingClient();
    await client.createRequest(create);
    await client.submitRequest(requestId, 1);
    await client.acceptQuotation(requestId, 1, { quotationId: requestId });
    await client.cancelOrder(requestId, 1, { reason: 'Plans changed' });
    await client.confirmReceipt(requestId, 1);

    expect(keys).toHaveLength(5);
    for (const key of keys) expect(key).toMatch(uuid);
    expect(new Set(keys).size).toBe(5);
  });

  it('sends the key the caller holds for the user action, so a retry reuses it', async () => {
    const { client, keys } = recordingClient();
    await client.createRequest(create, { idempotencyKey: 'action-1' });
    await client.createRequest(create, { idempotencyKey: 'action-1' });
    await client.submitRequest(requestId, 1, { idempotencyKey: 'action-2' });

    expect(keys).toEqual(['action-1', 'action-1', 'action-2']);
  });

  it('sends no key with reads or with the calls that are not retried by the user', async () => {
    const { client, keys } = recordingClient();
    await client.getRequest(requestId);
    await client.coordinate(requestId, 1);

    expect(keys).toEqual([null, null]);
  });
});
