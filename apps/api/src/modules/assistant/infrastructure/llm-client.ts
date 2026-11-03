/** What the classification pass decides about a message (PLAN E15 intent routing). */
export const ASSISTANT_INTENTS = [
  'site_help',
  'catalog',
  'trace',
  'village',
  'open_workshops',
  'chitchat',
  'out_of_scope',
  'injection',
  'abuse',
  'private_data',
] as const;
export type AssistantIntent = (typeof ASSISTANT_INTENTS)[number];

export interface Classification {
  intent: AssistantIntent;
  /** A short catalogue search query when the intent is `catalog`, else empty. */
  query: string;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export type LlmChunk = { type: 'text'; text: string } | { type: 'usage'; tokens: number };

/**
 * The chat model behind the assistant (ADR-19). The production adapter is `OpenAiLlmClient`; tests use a
 * fake. `classify` returns structured output; `stream` yields text and, at the end, the token usage.
 */
export interface LlmClient {
  classify(
    messages: readonly ChatMessage[],
    signal?: AbortSignal,
  ): Promise<Classification & { tokens: number }>;
  stream(
    messages: readonly ChatMessage[],
    options: { maxTokens: number; signal?: AbortSignal },
  ): AsyncIterable<LlmChunk>;
}

export const LLM_CLIENT = Symbol('LLM_CLIENT');
