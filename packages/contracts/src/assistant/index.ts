import { z } from 'zod';
import { IdSchema } from '../common';

/**
 * Fox assistant contracts (PLAN E15, FR-AST-02 … 05, 07), shared by the API, the worker and the web
 * widget. `POST /assistant/messages` streams Server-Sent Events whose `data` is one `AssistantEvent`.
 */

export const ASSISTANT_MESSAGE_MAX = 1_000;
export const ASSISTANT_HISTORY_MAX = 10;

const TurnSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().max(4_000),
});

export const AssistantMessageRequestSchema = z.strictObject({
  message: z.string().trim().min(1).max(ASSISTANT_MESSAGE_MAX),
  /** Earlier turns of this conversation, oldest first; only the last ten are kept. */
  history: z.array(TurnSchema).max(ASSISTANT_HISTORY_MAX).default([]),
  locale: z.enum(['vi', 'en']),
  /** The page the widget was opened on, for context (`/vi/san-pham/...`). Internal paths only. */
  pagePath: z
    .string()
    .max(300)
    .regex(/^\/(?!\/)[^\s\\]*$/, 'An internal path'),
  conversationId: IdSchema,
});
export type AssistantMessageRequest = z.infer<typeof AssistantMessageRequestSchema>;

/** A source an answer is based on; always an internal page. */
export const CitationSchema = z.object({
  title: z.string().max(200),
  url: z
    .string()
    .max(300)
    .regex(/^\/(?!\/)/, 'An internal path'),
  type: z.enum(['FAQ', 'PRODUCT', 'HOUSEHOLD', 'NEWS', 'VILLAGE', 'PAGE']),
});
export type CitationDto = z.infer<typeof CitationSchema>;

/** Why a message was refused (FR-AST-07); the widget shows a friendly line per reason. */
export const ASSISTANT_BLOCK_REASONS = [
  'INJECTION',
  'ABUSE',
  'PRIVATE_DATA',
  'RATE_LIMITED',
  'BUDGET_EXHAUSTED',
  'DISABLED',
] as const;

/** One SSE event of a streamed answer. */
export const AssistantEventSchema = z.discriminatedUnion('type', [
  /** Sent at once so the Fox switches to "thinking" before the first token. */
  z.object({ type: z.literal('thinking') }),
  z.object({ type: z.literal('delta'), text: z.string() }),
  z.object({ type: z.literal('citations'), citations: z.array(CitationSchema).max(8) }),
  z.object({ type: z.literal('done'), messageId: IdSchema }),
  z.object({
    type: z.literal('blocked'),
    reason: z.enum(ASSISTANT_BLOCK_REASONS),
    /** Seconds until the visitor may ask again (rate limit only). */
    retryAfter: z.int().nonnegative().optional(),
  }),
  z.object({ type: z.literal('error'), code: z.enum(['UPSTREAM', 'TIMEOUT', 'INTERNAL']) }),
]);
export type AssistantEvent = z.infer<typeof AssistantEventSchema>;

/** A finished answer, as the widget keeps it in its session history. */
export const AssistantAnswerSchema = z.object({
  messageId: IdSchema,
  text: z.string(),
  citations: z.array(CitationSchema),
});
export type AssistantAnswer = z.infer<typeof AssistantAnswerSchema>;

/** `POST /assistant/messages/{messageId}/feedback`: thumbs up or down. */
export const AssistantFeedbackRequestSchema = z.strictObject({
  rating: z.enum(['UP', 'DOWN']),
});
export type AssistantFeedbackRequest = z.infer<typeof AssistantFeedbackRequestSchema>;
