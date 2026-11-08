import { describe, expect, it } from 'vitest';
import {
  AccountApiError,
  ApiError,
  createAccountClient,
  createAuthedRequest,
  createQuotationClient,
  QuotationApiError,
} from '../src';

const challengePage = (status: number) =>
  new Response('<!DOCTYPE html><html><title>Just a moment...</title></html>', {
    status,
    headers: { 'content-type': 'text/html; charset=utf-8' },
  });

const getAccessToken = async () => 'session-token';

/** An edge or proxy answers an HTML page instead of an RFC 9457 document (Cloudflare challenge). */
describe('non-JSON error bodies', () => {
  it.each([
    [429, 'RATE_LIMITED'],
    [503, 'INTERNAL_ERROR'],
    [502, 'INTERNAL_ERROR'],
    [403, 'INTERNAL_ERROR'],
    [500, 'INTERNAL_ERROR'],
  ] as const)(
    'account client maps an HTML %i to %s without a parse error',
    async (status, code) => {
      const api = createAccountClient({ getAccessToken, fetch: async () => challengePage(status) });
      const error = await api.me().catch((e: unknown) => e);
      expect(error).toBeInstanceOf(AccountApiError);
      expect(error).toMatchObject({ code, status });
    },
  );

  it('account client maps an HTML 429 on a call whose success has no body too', async () => {
    const api = createAccountClient({ getAccessToken, fetch: async () => challengePage(429) });
    const error = await api.deleteAccount('DELETE').catch((e: unknown) => e);
    expect(error).toMatchObject({ code: 'RATE_LIMITED', status: 429 });
  });

  it('account client keeps the problem code of a real 429 problem+json', async () => {
    const api = createAccountClient({
      getAccessToken,
      fetch: async () =>
        Response.json(
          { type: 'about:blank', title: 'Too many requests', status: 429, code: 'RATE_LIMITED' },
          { status: 429 },
        ),
    });
    await expect(api.me()).rejects.toMatchObject({ code: 'RATE_LIMITED', status: 429 });
  });

  it('shared authed request maps an HTML 429 to ApiError RATE_LIMITED', async () => {
    const request = createAuthedRequest({ getAccessToken, fetch: async () => challengePage(429) });
    const error = await request('/anything', { parse: (data) => data }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ code: 'RATE_LIMITED', status: 429 });
  });

  it('quotation client keeps an HTML 503 as INTERNAL_ERROR with its status', async () => {
    const api = createQuotationClient({ getAccessToken, fetch: async () => challengePage(503) });
    const error = await api.recordConsent('RFQ_CONTACT', '2026-01').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(QuotationApiError);
    expect(error).toMatchObject({ code: 'INTERNAL_ERROR', status: 503 });
  });
});
