import { describe, expect, it, vi } from 'vitest';
import { OpenAiLlmClient } from './openai-llm-client';

function sse(lines: string[]): Response {
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      const bytes = new TextEncoder().encode(lines.map((l) => `data: ${l}\n\n`).join(''));
      // Split mid-line to prove the parser buffers partial events.
      controller.enqueue(bytes.slice(0, 17));
      controller.enqueue(bytes.slice(17));
      controller.close();
    },
  });
  return new Response(body);
}

describe('OpenAiLlmClient', () => {
  it('parses a structured classification and falls back to site_help on an unknown intent', async () => {
    const reply = (content: string) =>
      new Response(
        JSON.stringify({ choices: [{ message: { content } }], usage: { total_tokens: 42 } }),
      );
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(reply('{"intent":"catalog","query":"binh"}'))
      .mockResolvedValueOnce(reply('{"intent":"hack","query":""}'));
    const client = new OpenAiLlmClient('key', 'model', fetchImpl);
    expect(await client.classify([])).toEqual({ intent: 'catalog', query: 'binh', tokens: 42 });
    expect((await client.classify([])).intent).toBe('site_help');
    const sent = JSON.parse(fetchImpl.mock.calls[0]?.[1].body);
    expect(sent.model).toBe('model');
    expect(sent.response_format.json_schema.strict).toBe(true);
  });

  it('falls back to the in-scope default when the classification comes back empty or invalid (GH#233)', async () => {
    const reply = (content: string | undefined) =>
      new Response(
        JSON.stringify({ choices: [{ message: { content } }], usage: { total_tokens: 200 } }),
      );
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(reply(''))
      .mockResolvedValueOnce(reply(undefined))
      .mockResolvedValueOnce(reply('{"intent":'))
      .mockResolvedValueOnce(reply('null'));
    const client = new OpenAiLlmClient('key', 'model', fetchImpl);
    for (let i = 0; i < 4; i++)
      expect(await client.classify([])).toEqual({ intent: 'site_help', query: '', tokens: 200 });
    // Room for hidden reasoning tokens as well as the JSON itself.
    expect(JSON.parse(fetchImpl.mock.calls[0]?.[1].body).max_completion_tokens).toBeGreaterThan(
      200,
    );
  });

  it('streams text deltas and the final usage', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(
        sse([
          JSON.stringify({ choices: [{ delta: { content: 'Chào ' } }] }),
          JSON.stringify({ choices: [{ delta: { content: 'bạn' } }] }),
          JSON.stringify({ choices: [], usage: { total_tokens: 9 } }),
          '[DONE]',
        ]),
      );
    const chunks = [];
    for await (const chunk of new OpenAiLlmClient('k', 'm', fetchImpl).stream([], {
      maxTokens: 10,
    }))
      chunks.push(chunk);
    expect(chunks).toEqual([
      { type: 'text', text: 'Chào ' },
      { type: 'text', text: 'bạn' },
      { type: 'usage', tokens: 9 },
    ]);
  });

  it('throws on an HTTP error so the caller can report UPSTREAM', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response('no', { status: 500 }));
    await expect(new OpenAiLlmClient('k', 'm', fetchImpl).classify([])).rejects.toThrow('500');
  });
});
