import { describe, expect, it } from 'vitest';
import { createPaymentClient, createQuotationClient, createStudioClient } from '../src';

const id = '123e4567-e89b-12d3-a456-426614174000';
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** Records the headers of every call; the body is never a valid response, so each call rejects. */
function recorder() {
  const calls: { path: string; key: string | null }[] = [];
  const options = {
    getAccessToken: async () => 'session-token',
    fetch: async (url: string, init: RequestInit) => {
      const headers = new Request(`https://vcraft.test${url}`, init).headers;
      calls.push({ path: url, key: headers.get('idempotency-key') });
      return Response.json({});
    },
  };
  return { calls, options };
}

describe('Idempotency-Key on state-changing calls (BR-L5, GH#348)', () => {
  it('sends a fresh UUID with product create, duplicate, journal entry and payment calls', async () => {
    const { calls, options } = recorder();
    const studio = createStudioClient(options);
    const payments = createPaymentClient(options);
    const rfq = createQuotationClient(options);
    const ignore = () => undefined;
    await studio.createProduct({ name: 'Bowl' } as never).catch(ignore);
    await studio.duplicateProduct(id).catch(ignore);
    await studio.appendJournalEntry(id, {} as never).catch(ignore);
    await payments
      .createPayment(id, { kind: 'DEPOSIT', method: 'SEPAY_TRANSFER' } as never)
      .catch(ignore);
    await payments.recordOfflinePayment(id, { kind: 'BALANCE', note: 'cash' }).catch(ignore);
    await rfq.duplicateRequest(id).catch(ignore);

    expect(calls).toHaveLength(6);
    for (const call of calls) expect(call.key).toMatch(uuid);
    expect(new Set(calls.map((call) => call.key)).size).toBe(6);
  });

  it('sends the key the caller holds, so a retry of the same action reuses it', async () => {
    const { calls, options } = recorder();
    const studio = createStudioClient(options);
    const ignore = () => undefined;
    await studio.createProduct({ name: 'Bowl' } as never, { idempotencyKey: 'a-1' }).catch(ignore);
    await studio.createProduct({ name: 'Bowl' } as never, { idempotencyKey: 'a-1' }).catch(ignore);

    expect(calls.map((call) => call.key)).toEqual(['a-1', 'a-1']);
  });

  it('sends no key with reads', async () => {
    const { calls, options } = recorder();
    await createStudioClient(options)
      .getJournal(id)
      .catch(() => undefined);

    expect(calls.map((call) => call.key)).toEqual([null]);
  });
});
