import {
  ASSISTANT_INTENTS,
  type ChatMessage,
  type Classification,
  type LlmChunk,
  type LlmClient,
} from './llm-client';

const ENDPOINT = 'https://api.openai.com/v1/chat/completions';

/**
 * OpenAI Chat Completions over HTTPS with no SDK (ADR-19, `OPENAI_CHAT_MODEL`). Classification uses a
 * strict JSON schema; answers stream as Server-Sent Events with the usage in the last chunk.
 */
export class OpenAiLlmClient implements LlmClient {
  constructor(
    private readonly apiKey: string,
    private readonly model: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  private post(body: object, signal?: AbortSignal) {
    return this.fetchImpl(ENDPOINT, {
      method: 'POST',
      headers: { authorization: `Bearer ${this.apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({ model: this.model, ...body }),
      ...(signal ? { signal } : {}),
    });
  }

  async classify(
    messages: readonly ChatMessage[],
    signal?: AbortSignal,
  ): Promise<Classification & { tokens: number }> {
    const res = await this.post(
      {
        messages,
        max_completion_tokens: 200,
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'classification',
            strict: true,
            schema: {
              type: 'object',
              additionalProperties: false,
              required: ['intent', 'query'],
              properties: {
                intent: { type: 'string', enum: [...ASSISTANT_INTENTS] },
                query: { type: 'string' },
              },
            },
          },
        },
      },
      signal,
    );
    if (!res.ok) throw new Error(`classification failed: ${res.status}`);
    const body = (await res.json()) as {
      choices: { message: { content: string } }[];
      usage?: { total_tokens?: number };
    };
    const parsed = JSON.parse(body.choices[0]?.message.content ?? '{}') as Partial<Classification>;
    const intent = ASSISTANT_INTENTS.includes(parsed.intent as never)
      ? (parsed.intent as Classification['intent'])
      : 'site_help';
    return { intent, query: String(parsed.query ?? ''), tokens: body.usage?.total_tokens ?? 0 };
  }

  async *stream(
    messages: readonly ChatMessage[],
    options: { maxTokens: number; signal?: AbortSignal },
  ): AsyncIterable<LlmChunk> {
    const res = await this.post(
      {
        messages,
        stream: true,
        stream_options: { include_usage: true },
        max_completion_tokens: options.maxTokens,
      },
      options.signal,
    );
    if (!res.ok || !res.body) throw new Error(`completion failed: ${res.status}`);
    const decoder = new TextDecoder();
    let buffer = '';
    for await (const bytes of res.body as unknown as AsyncIterable<Uint8Array>) {
      buffer += decoder.decode(bytes, { stream: true });
      let newline = buffer.indexOf('\n');
      while (newline >= 0) {
        const line = buffer.slice(0, newline).trim();
        buffer = buffer.slice(newline + 1);
        newline = buffer.indexOf('\n');
        if (!line.startsWith('data:')) continue;
        const data = line.slice(5).trim();
        if (data === '[DONE]') return;
        const event = JSON.parse(data) as {
          choices?: { delta?: { content?: string } }[];
          usage?: { total_tokens?: number } | null;
        };
        const text = event.choices?.[0]?.delta?.content;
        if (text) yield { type: 'text', text };
        if (event.usage?.total_tokens) yield { type: 'usage', tokens: event.usage.total_tokens };
      }
    }
  }
}
