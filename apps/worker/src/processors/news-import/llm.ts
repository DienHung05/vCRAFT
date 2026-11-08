export interface LlmMessage {
  role: 'system' | 'user';
  content: string;
}

/** The chat model the news job uses to paraphrase and to write evergreen articles; returns a JSON string. */
export interface NewsLlm {
  completeJson(messages: readonly LlmMessage[]): Promise<string>;
}

const ENDPOINT = 'https://api.openai.com/v1/chat/completions';

/** OpenAI Chat Completions over HTTPS with no SDK, the same provider as the assistant (ADR-19). */
export class OpenAiNewsLlm implements NewsLlm {
  constructor(
    private readonly apiKey: string,
    private readonly model: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async completeJson(messages: readonly LlmMessage[]): Promise<string> {
    const res = await this.fetchImpl(ENDPOINT, {
      method: 'POST',
      headers: { authorization: `Bearer ${this.apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        model: this.model,
        messages,
        max_completion_tokens: 4000,
        response_format: { type: 'json_object' },
      }),
      signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok) throw new Error(`llm request failed: ${res.status}`);
    const body = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const content = body.choices?.[0]?.message?.content;
    if (!content) throw new Error('llm returned no content');
    return content;
  }
}

/** The configured model, or `null` without an API key (the job then runs without paraphrase or filler). */
export function llmFromEnv(env: NodeJS.ProcessEnv = process.env): NewsLlm | null {
  const key = env.OPENAI_API_KEY?.trim();
  return key ? new OpenAiNewsLlm(key, env.OPENAI_CHAT_MODEL?.trim() || 'gpt-6-luna') : null;
}
