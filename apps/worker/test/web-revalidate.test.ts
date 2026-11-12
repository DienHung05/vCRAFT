import { describe, expect, it, vi } from 'vitest';
import { createOutboxDispatcher } from '../src/processors/outbox/dispatch';
import {
  createWebRevalidator,
  revalidateTagsOf,
  webRevalidateFromEnv,
} from '../src/processors/outbox/revalidate-web';

const sink = { add: vi.fn(async () => undefined) };
const queues = { media: sink, mail: sink, qrLabels: sink, scheduler: sink, assistant: sink };

describe('webRevalidateFromEnv (ADR-0027)', () => {
  it('is off unless both WEB_REVALIDATE_URL and REVALIDATE_SECRET are set', () => {
    expect(webRevalidateFromEnv({})).toBeNull();
    expect(
      webRevalidateFromEnv({ WEB_REVALIDATE_URL: 'https://web.test/api/revalidate' }),
    ).toBeNull();
    expect(webRevalidateFromEnv({ REVALIDATE_SECRET: 'x' })).toBeNull();
    expect(webRevalidateFromEnv({ WEB_REVALIDATE_URL: ' ', REVALIDATE_SECRET: 'x' })).toBeNull();
  });

  it('is off for a URL that is not http(s)', () => {
    expect(
      webRevalidateFromEnv({ WEB_REVALIDATE_URL: 'not a url', REVALIDATE_SECRET: 'x' }),
    ).toBeNull();
    expect(
      webRevalidateFromEnv({ WEB_REVALIDATE_URL: 'file:///etc/passwd', REVALIDATE_SECRET: 'x' }),
    ).toBeNull();
  });

  it('reads both values', () => {
    expect(
      webRevalidateFromEnv({
        WEB_REVALIDATE_URL: 'https://web.test/api/revalidate',
        REVALIDATE_SECRET: ' secret ',
      }),
    ).toEqual({ url: 'https://web.test/api/revalidate', secret: 'secret' });
  });
});

describe('revalidateTagsOf', () => {
  it('keeps valid, distinct tags', () => {
    expect(revalidateTagsOf({ tags: ['exhibition', 'trace:AB12', 'trace:AB12'] })).toEqual([
      'exhibition',
      'trace:AB12',
    ]);
  });

  it('widens to the broad tag when the payload is missing, empty or has a bad tag', () => {
    expect(revalidateTagsOf({})).toEqual(['exhibition']);
    expect(revalidateTagsOf({ tags: [] })).toEqual(['exhibition']);
    expect(revalidateTagsOf({ tags: ['product:ok', 'bad tag'] })).toEqual(['exhibition']);
  });
});

describe('createWebRevalidator', () => {
  const config = { url: 'https://web.test/api/revalidate', secret: 'top-secret' };

  it('does nothing when unconfigured', async () => {
    const fetchImpl = vi.fn();
    await createWebRevalidator(null, fetchImpl as never)(['exhibition']);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('POSTs the tags with the bearer secret', async () => {
    const fetchImpl = vi.fn(async () => new Response('{}', { status: 200 }));
    await createWebRevalidator(config, fetchImpl as never)(['exhibition', 'household:a']);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(config.url);
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>).authorization).toBe('Bearer top-secret');
    expect(JSON.parse(String(init.body))).toEqual({ tags: ['exhibition', 'household:a'] });
  });

  it('throws on a non-2xx answer, without the secret in the message', async () => {
    const fetchImpl = vi.fn(async () => new Response('no', { status: 401 }));
    const run = createWebRevalidator(config, fetchImpl as never)(['exhibition']);
    await expect(run).rejects.toThrow('HTTP 401');
    await expect(run).rejects.not.toThrow(/top-secret/);
  });
});

describe('outbox dispatcher: exhibition.changed', () => {
  it('delivers the payload tags to the revalidator', async () => {
    const revalidate = vi.fn(async () => undefined);
    const dispatch = createOutboxDispatcher(queues, Date.now, revalidate);
    await dispatch({
      id: 'e1',
      type: 'exhibition.changed',
      payload: { tags: ['exhibition', 'household:lo-duc-phat'] },
    });
    expect(revalidate).toHaveBeenCalledWith(['exhibition', 'household:lo-duc-phat']);
    expect(sink.add).not.toHaveBeenCalled();
  });

  it('lets a delivery failure propagate so the outbox retries the event', async () => {
    const dispatch = createOutboxDispatcher(queues, Date.now, async () => {
      throw new Error('web down');
    });
    await expect(
      dispatch({ id: 'e2', type: 'exhibition.changed', payload: { tags: ['exhibition'] } }),
    ).rejects.toThrow('web down');
  });

  it('sends nothing without WEB_REVALIDATE_URL / REVALIDATE_SECRET and still completes', async () => {
    const fetchImpl = vi.fn();
    const dispatch = createOutboxDispatcher(
      queues,
      Date.now,
      createWebRevalidator(webRevalidateFromEnv({}), fetchImpl as never),
    );
    await expect(
      dispatch({ id: 'e3', type: 'exhibition.changed', payload: { tags: ['exhibition'] } }),
    ).resolves.toBeUndefined();
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
