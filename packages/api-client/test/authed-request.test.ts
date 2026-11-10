import { MeResponseSchema } from '@vcraft/contracts';
import { describe, expect, it } from 'vitest';
import {
  AccountApiError,
  ApiError,
  type AuthedClientOptions,
  createAccountClient,
  createAuthedRequest,
  createQuotationClient,
  QuotationApiError,
} from '../src';

const getAccessToken = async () => 'session-token';
const schema = { parse: (data: unknown) => data };
const clients = [
  {
    name: 'account',
    ErrorType: AccountApiError,
    read: (options: AuthedClientOptions) => createAccountClient(options).me(),
  },
  {
    name: 'quotation',
    ErrorType: QuotationApiError,
    read: (options: AuthedClientOptions) => createQuotationClient(options).listInvitations(),
  },
];

describe('authenticated requests', () => {
  it.each(clients)(
    '$name rejects malformed successful responses with its API error',
    async ({ read, ErrorType }) => {
      const error = await read({
        getAccessToken,
        fetch: async () => Response.json({ unexpected: true }),
      }).catch((error: unknown) => error);
      expect(error).toBeInstanceOf(ErrorType);
      expect(error).toMatchObject({ code: 'INTERNAL_ERROR', status: 200, fieldErrors: [] });
    },
  );

  it.each(clients)(
    '$name preserves cancellation while reading the response body',
    async ({ read }) => {
      const controller = new AbortController();
      const reason = new DOMException('Cancelled during download', 'AbortError');
      await expect(
        read({
          getAccessToken,
          signal: controller.signal,
          fetch: async () =>
            new Response(
              new ReadableStream({
                start(stream) {
                  controller.abort(reason);
                  stream.error(reason);
                },
              }),
            ),
        }),
      ).rejects.toBe(reason);
    },
  );

  it.each(clients)('$name requests can be cancelled with the client signal', async ({ read }) => {
    const controller = new AbortController();
    const reason = new DOMException('Cancelled by caller', 'AbortError');
    await expect(
      read({
        getAccessToken,
        signal: controller.signal,
        fetch: async (_url, init) => {
          expect(init.signal).toBe(controller.signal);
          controller.abort(reason);
          init.signal?.throwIfAborted();
          return Response.json({});
        },
      }),
    ).rejects.toBe(reason);
  });

  it('forwards a per-request signal so a fetch can be cancelled', async () => {
    const controller = new AbortController();
    const reason = new DOMException('Cancelled by caller', 'AbortError');
    const request = createAuthedRequest({
      getAccessToken,
      fetch: async (_url, init) => {
        expect(init.signal).toBe(controller.signal);
        controller.abort(reason);
        init.signal?.throwIfAborted();
        return Response.json({});
      },
    });
    await expect(request('/anything', schema, { signal: controller.signal })).rejects.toBe(reason);
  });

  it.each(clients)(
    '$name errors retain field errors and support both catch types',
    async ({ read, ErrorType }) => {
      const fieldErrors = [{ path: 'quantity', code: 'too_small', message: 'Enter a quantity.' }];
      const error = await read({
        getAccessToken,
        fetch: async () =>
          Response.json(
            {
              type: '/problems/validation-failed',
              title: 'Validation failed',
              status: 422,
              code: 'VALIDATION_FAILED',
              errors: fieldErrors,
            },
            { status: 422 },
          ),
      }).catch((error: unknown) => error);
      expect(error).toBeInstanceOf(ApiError);
      expect(error).toBeInstanceOf(ErrorType);
      expect(error).toMatchObject({ code: 'VALIDATION_FAILED', status: 422, fieldErrors });
    },
  );

  it.each([200, 204])('reports an invalid %i response as an API error', async (status) => {
    const request = createAuthedRequest({
      getAccessToken,
      fetch: async () => (status === 204 ? new Response(null, { status }) : Response.json({})),
    });
    const error = await request('/me', MeResponseSchema).catch((error: unknown) => error);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ code: 'INTERNAL_ERROR', status, fieldErrors: [] });
  });

  it('preserves RFC 9457 field errors for forms', async () => {
    const fieldErrors = [{ path: 'quantity', code: 'too_small', message: 'Enter a quantity.' }];
    const request = createAuthedRequest({
      getAccessToken,
      fetch: async () =>
        Response.json(
          {
            type: '/problems/validation-failed',
            title: 'Validation failed',
            status: 422,
            code: 'VALIDATION_FAILED',
            errors: fieldErrors,
          },
          { status: 422 },
        ),
    });
    const error = await request('/anything', schema).catch((error: unknown) => error);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ code: 'VALIDATION_FAILED', status: 422, fieldErrors });
  });
});
