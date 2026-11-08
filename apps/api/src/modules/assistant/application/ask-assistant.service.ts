import { randomBytes } from 'node:crypto';
import { MikroORM } from '@mikro-orm/core';
import { Inject, Injectable, Logger } from '@nestjs/common';
import type {
  AssistantEvent,
  AssistantFeedbackRequest,
  AssistantMessageRequest,
  CitationDto,
} from '@vcraft/contracts';
import { AssistantMessageLog } from '@vcraft/database';
import type { KnowledgeMatch } from '@vcraft/knowledge';
import { maskPii } from '@vcraft/utils';
import { notFound } from '../../../common/errors/app-error';
import {
  EMBEDDER,
  type Embedder,
  VECTOR_STORE,
  type VectorStore,
} from '../../../infrastructure/vector/vector.module';
import { ASSISTANT_KV, type KeyValueStore } from '../infrastructure/key-value';
import {
  type AssistantIntent,
  type ChatMessage,
  LLM_CLIENT,
  type LlmChunk,
  type LlmClient,
} from '../infrastructure/llm-client';
import { CatalogToolsService, type ToolResult } from './catalog-tools.service';
import { cannedReply, fastIntent, weatherPlace } from './fast-intents';
import {
  type BlockReason,
  BudgetGuard,
  GuardrailPipeline,
  RateLimiter,
  StreamingOutputFilter,
  sanitizeInput,
} from './guardrails';
import { chatMessages, classifierPrompt } from './prompt';
import { siteHelpQuery } from './site-help';
import { getCurrentDatetime, getWeather, TOOL_TIMEOUT_MS, weatherFallback } from './tools';

/** Runtime settings of the assistant, read from the environment by `AssistantModule`. */
export interface AssistantConfig {
  /** `ASSISTANT_ENABLED=false` turns the assistant off (FR-AST-07 feature flag). */
  enabled: boolean;
  /** Daily token ceiling across all visitors (`ASSISTANT_DAILY_TOKENS`); 0 means no ceiling. */
  dailyTokens: number;
  /** Messages a minute per IP and per conversation (`ASSISTANT_RATE_LIMIT_PER_MINUTE`); 0 or absent means no limit. */
  rateLimitPerMinute?: number;
  /** Messages a day per IP and per conversation (`ASSISTANT_RATE_LIMIT_PER_DAY`); 0 or absent means no limit. */
  rateLimitPerDay?: number;
  /** Absolute origins answers may link to besides internal paths (`CORS_ORIGINS`, the site itself). */
  allowedOrigins: string[];
  /** `max_tokens` of one answer. */
  maxAnswerTokens: number;
}

export const ASSISTANT_CONFIG = Symbol('ASSISTANT_CONFIG');

const RETRIEVAL_LIMIT = 4;
const MIN_SIMILARITY = 0.3;
// The model has this long to start answering before the visitor gets a friendly timeout.
const ANSWER_TIMEOUT_MS = 30_000;

// A message the heuristic scanner rates at or above this is not answered speculatively.
const SPECULATE_BELOW_SUSPICION = 0.3;

const BLOCKED_INTENTS: Partial<Record<AssistantIntent, BlockReason>> = {
  injection: 'INJECTION',
  abuse: 'ABUSE',
  private_data: 'PRIVATE_DATA',
};

const OUT_OF_SCOPE = {
  vi: 'Câu này nằm ngoài chuyên môn của tớ rồi. Tớ chỉ giúp được về gốm Bát Tràng và cách dùng vCraft thôi, bạn nên hỏi chuyên gia nhé.',
  en: "That's outside what I know. I can only help with Bát Tràng pottery and using vCraft, so please ask an expert.",
};

interface Turn {
  intent: string;
  blocked?: BlockReason;
  answered: boolean;
  firstTokenMs: number | null;
  tokens: number;
}

/** An answer call already under way: its first chunk is requested, the rest is not read yet. */
interface AnswerStream {
  /** The prompt and token limit it was built from, to tell whether it still matches the final prompt. */
  key: string;
  iterator: AsyncIterator<LlmChunk>;
  first: Promise<IteratorResult<LlmChunk>>;
  timeout: AbortSignal;
  discard: () => void;
}

async function* drain({ iterator, first }: AnswerStream): AsyncGenerator<LlmChunk> {
  let step = await first;
  while (!step.done) {
    yield step.value;
    step = await iterator.next();
  }
}

const citationOf = (m: KnowledgeMatch): CitationDto => ({
  title: m.title.slice(0, 200),
  url: m.url,
  type: m.sourceType,
});

/**
 * One assistant turn (FR-AST-02 … 05, PLAN E15): guardrails, intent routing, retrieval and tools, then a
 * streamed answer through the output filter. Yields the SSE events the controller writes; every turn is
 * logged anonymously. Principle: block real attacks, never block real users.
 */
@Injectable()
export class AskAssistantService {
  private readonly logger = new Logger(AskAssistantService.name);
  private readonly rateLimiter: RateLimiter;
  private readonly budget: BudgetGuard;

  constructor(
    private readonly orm: MikroORM,
    private readonly tools: CatalogToolsService,
    @Inject(ASSISTANT_KV) private readonly kv: KeyValueStore,
    @Inject(LLM_CLIENT) private readonly llm: LlmClient | null,
    @Inject(VECTOR_STORE) private readonly vectors: VectorStore,
    @Inject(EMBEDDER) private readonly embedder: Embedder,
    @Inject(ASSISTANT_CONFIG) private readonly config: AssistantConfig,
  ) {
    this.rateLimiter = new RateLimiter(kv, config.rateLimitPerMinute, config.rateLimitPerDay);
    this.budget = new BudgetGuard(kv, config.dailyTokens);
  }

  async *ask(
    input: AssistantMessageRequest,
    ipHash: string,
    signal?: AbortSignal,
  ): AsyncGenerator<AssistantEvent> {
    const started = Date.now();
    yield { type: 'thinking' };
    const { message, suspicion } = sanitizeInput(input.message);
    const log = (turn: Turn) => this.log(input, message, ipHash, turn);
    const blocked = async function* (reason: BlockReason, intent: string, retryAfter?: number) {
      const id = await log({
        intent,
        blocked: reason,
        answered: false,
        firstTokenMs: null,
        tokens: 0,
      });
      yield {
        type: 'blocked',
        reason,
        ...(retryAfter !== undefined && { retryAfter: Math.max(0, retryAfter) }),
      } satisfies AssistantEvent;
      return id;
    };
    const reply = async function* (text: string, intent: string, citations: CitationDto[] = []) {
      yield { type: 'delta', text } satisfies AssistantEvent;
      if (citations.length) yield { type: 'citations', citations } satisfies AssistantEvent;
      const messageId = await log({
        intent,
        answered: true,
        firstTokenMs: Date.now() - started,
        tokens: 0,
      });
      yield { type: 'done', messageId } satisfies AssistantEvent;
    };

    if (!this.config.enabled) return yield* blocked('DISABLED', 'disabled');

    const ctx = { message, suspicion, ipHash, conversationId: input.conversationId };
    if (this.rateLimiter.enabled) {
      const limited = await new GuardrailPipeline([this.rateLimiter]).run(ctx);
      if (!limited.ok) return yield* blocked(limited.reason, 'rate_limited', limited.retryAfter);
    }

    // Fast intents never reach the model, so they cost no budget and answer in well under 100 ms.
    const fast = fastIntent(message);
    if (fast === 'greeting' || fast === 'thanks' || fast === 'bye')
      return yield* reply(cannedReply(fast, input.locale), fast);
    if (fast === 'datetime')
      return yield* reply(getCurrentDatetime(new Date(), input.locale), 'datetime');
    if (fast === 'weather') {
      const weather = await getWeather(
        { place: weatherPlace(message) },
        input.locale,
        this.kv,
        fetch,
        this.logger,
      );
      return yield* reply(weather ?? weatherFallback(input.locale), 'weather');
    }

    const budget = await new GuardrailPipeline([this.budget]).run(ctx);
    if (!budget.ok || !this.llm)
      return yield* blocked(budget.ok ? 'DISABLED' : budget.reason, 'budget');
    const llm = this.llm;

    const canary = `vc${randomBytes(9).toString('hex')}`;
    const answer = (messages: ChatMessage[], maxTokens: number): AnswerStream => {
      const controller = new AbortController();
      const timeout = AbortSignal.timeout(ANSWER_TIMEOUT_MS);
      const signals = [controller.signal, timeout, ...(signal ? [signal] : [])];
      const iterator = llm
        .stream(messages, { maxTokens, signal: AbortSignal.any(signals) })
        [Symbol.asyncIterator]();
      // Pulling the first chunk sends the request; nothing is read past it until the answer is committed.
      const first = iterator.next();
      first.catch(() => undefined);
      return {
        key: JSON.stringify([messages, maxTokens]),
        iterator,
        first,
        timeout,
        discard: () => {
          controller.abort();
          iterator.return?.()?.catch(() => undefined);
        },
      };
    };

    // Classification, retrieval and the page lookup run side by side. The answer call also starts now, on
    // the generic context, so its first token does not wait for classification (NFR-PERF-08). Its output
    // is held back: only after the classification passes, and only when the final prompt is the same, is
    // it released through the output filter; otherwise it is aborted and discarded unseen.
    const classifying = llm
      .classify(
        [
          { role: 'system', content: classifierPrompt(suspicion) },
          ...input.history.slice(-4).map((t) => ({ role: t.role, content: t.content })),
          { role: 'user', content: message },
        ],
        signal,
      )
      .catch((error: unknown) => {
        this.logger.warn(`assistant classification failed: ${String(error)}`);
        return null;
      });
    const retrieving = this.retrieve(message, input.locale);
    const pageNote = this.tools.pageContext(input.pagePath, input.locale).catch(() => null);
    // A suspicious message is not worth a speculative answer; it waits for the classifier.
    let discarded = suspicion >= SPECULATE_BELOW_SUSPICION;
    const speculation: Promise<AnswerStream | null> = Promise.all([retrieving, pageNote]).then(
      ([found, page]) =>
        discarded
          ? null
          : answer(
              chatMessages(input, message, canary, { matches: found, tools: [], page }),
              this.config.maxAnswerTokens,
            ),
    );
    const discardSpeculation = () => {
      discarded = true;
      void speculation.then((s) => s?.discard());
    };

    const [classified, matches, page] = await Promise.all([classifying, retrieving, pageNote]);
    if (!classified) {
      discardSpeculation();
      yield { type: 'error', code: 'UPSTREAM' };
      await log({ intent: 'unknown', answered: false, firstTokenMs: null, tokens: 0 });
      return;
    }
    await this.budget.record(classified.tokens);
    const { intent } = classified;

    const blockedBy = BLOCKED_INTENTS[intent];
    if (blockedBy) {
      discardSpeculation();
      return yield* blocked(blockedBy, intent);
    }
    if (intent === 'out_of_scope') {
      discardSpeculation();
      return yield* reply(OUT_OF_SCOPE[input.locale], intent);
    }

    const toolResults: ToolResult[] = [];
    if (intent === 'catalog') {
      const found = await this.tools.searchCatalog(classified.query || message, input.locale);
      if (found) toolResults.push(found);
    }
    if (intent === 'open_workshops') {
      const open = await this.tools.openWorkshops(new Date(), input.locale);
      if (open) toolResults.push(open);
    }
    // Only expand after classification and blocked-intent checks. A guide question never bypasses guards.
    const guideMatches =
      intent === 'site_help'
        ? await this.retrieve(
            siteHelpQuery(message, input.pagePath, input.locale),
            input.locale,
            true,
          )
        : [];
    const offTopic = intent === 'off_topic';
    const context =
      intent === 'chitchat' || offTopic ? [] : guideMatches.length ? guideMatches : matches;
    const citations = [...context.map(citationOf), ...toolResults.flatMap((t) => t.citations)]
      .filter((c, i, all) => all.findIndex((o) => o.url === c.url) === i)
      .slice(0, 8);

    const filter = new StreamingOutputFilter(canary, this.config.allowedOrigins);
    const messages = chatMessages(input, message, canary, {
      matches: context,
      tools: toolResults,
      page,
      offTopic,
    });
    const maxTokens = intent === 'chitchat' || offTopic ? 150 : this.config.maxAnswerTokens;
    // Keep the speculative answer only when it was built from exactly this prompt.
    const early = await speculation;
    const final = early?.key === JSON.stringify([messages, maxTokens]) ? early : null;
    if (!final) discardSpeculation();
    const stream = final ?? answer(messages, maxTokens);
    const { timeout } = stream;
    let firstTokenMs: number | null = null;
    let tokens = 0;
    try {
      for await (const chunk of drain(stream)) {
        if (chunk.type === 'usage') {
          tokens = chunk.tokens;
          continue;
        }
        const text = filter.push(chunk.text);
        if (filter.leaked) break;
        if (text) {
          firstTokenMs ??= Date.now() - started;
          yield { type: 'delta', text };
        }
      }
    } catch (error) {
      await this.budget.record(tokens);
      if (signal?.aborted) return;
      this.logger.warn(`assistant answer failed: ${String(error)}`);
      yield { type: 'error', code: timeout.aborted ? 'TIMEOUT' : 'UPSTREAM' };
      await log({ intent, answered: false, firstTokenMs, tokens: classified.tokens + tokens });
      return;
    }
    await this.budget.record(tokens);
    const rest = filter.end();
    if (filter.leaked) {
      this.logger.warn('assistant canary leaked: answer withheld');
      return yield* blocked('INJECTION', intent);
    }
    if (rest) {
      firstTokenMs ??= Date.now() - started;
      yield { type: 'delta', text: rest };
    }
    if (citations.length) yield { type: 'citations', citations };
    const messageId = await log({
      intent,
      answered: citations.length > 0 || intent === 'chitchat' || offTopic,
      firstTokenMs,
      tokens: classified.tokens + tokens,
    });
    yield { type: 'done', messageId };
  }

  async feedback(messageId: string, { rating }: AssistantFeedbackRequest): Promise<void> {
    const em = this.orm.em.fork();
    const row = await em.findOne(AssistantMessageLog, { id: messageId });
    if (!row) throw notFound('Assistant message not found');
    row.feedback = rating;
    await em.flush();
  }

  private async retrieve(
    message: string,
    locale: 'vi' | 'en',
    guidesOnly = false,
  ): Promise<KnowledgeMatch[]> {
    try {
      const work = (async () => {
        const [embedding] = await this.embedder.embed([message]);
        if (!embedding) return [];
        const found = await this.vectors.search(embedding, {
          locale,
          limit: RETRIEVAL_LIMIT,
          minSimilarity: MIN_SIMILARITY,
          ...(guidesOnly && { sourceType: 'FAQ' as const }),
        });
        return found;
      })();
      const timeout = new Promise<KnowledgeMatch[]>((resolve) =>
        setTimeout(() => resolve([]), TOOL_TIMEOUT_MS).unref(),
      );
      return await Promise.race([work, timeout]);
    } catch (error) {
      this.logger.warn(`assistant retrieval failed: ${String(error)}`);
      return [];
    }
  }

  private async log(
    input: AssistantMessageRequest,
    message: string,
    ipHash: string,
    turn: Turn,
  ): Promise<string> {
    const em = this.orm.em.fork();
    const row = em.create(AssistantMessageLog, {
      ipHash,
      locale: input.locale,
      question: maskPii(message).slice(0, 300),
      intent: turn.intent,
      blocked: turn.blocked !== undefined,
      blockReason: turn.blocked ?? null,
      answered: turn.answered,
      firstTokenMs: turn.firstTokenMs,
      tokens: turn.tokens,
    });
    await em.flush();
    return row.id;
  }
}
