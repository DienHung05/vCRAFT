import { Inject, Module, type OnApplicationShutdown } from '@nestjs/common';
import {
  ASSISTANT_CONFIG,
  AskAssistantService,
  type AssistantConfig,
} from './application/ask-assistant.service';
import { AssistantStatsService } from './application/assistant-stats.service';
import { CatalogToolsService } from './application/catalog-tools.service';
import { positiveInt } from './application/guardrails';
import { AssistantController, AssistantStatsController } from './assistant.controller';
import {
  ASSISTANT_KV,
  InMemoryKeyValueStore,
  type KeyValueStore,
  RedisKeyValueStore,
} from './infrastructure/key-value';
import { LLM_CLIENT, type LlmClient } from './infrastructure/llm-client';
import { OpenAiLlmClient } from './infrastructure/openai-llm-client';
import { ScriptedLlmClient } from './infrastructure/scripted-llm-client';

const origins = (raw = '') =>
  raw
    .split(',')
    .map((origin) => origin.trim().replace(/\/+$/, ''))
    .filter(Boolean);

/**
 * The Fox assistant (PLAN E15, ADR-19). Settings come from the environment:
 * `ASSISTANT_ENABLED=false` turns it off, `ASSISTANT_LLM=scripted` swaps in the offline stand-in, `OPENAI_API_KEY` + `OPENAI_CHAT_MODEL` pick the model (without a
 * key only greetings, date and weather are answered), `REDIS_URL` holds rate limits and the token budget
 * (in memory without it). No usage limit applies by default; `ASSISTANT_RATE_LIMIT_PER_MINUTE`,
 * `ASSISTANT_RATE_LIMIT_PER_DAY` (per IP and per conversation) and `ASSISTANT_DAILY_TOKENS` (all
 * visitors) each turn one on when set to a positive integer.
 */
@Module({
  controllers: [AssistantController, AssistantStatsController],
  providers: [
    AskAssistantService,
    AssistantStatsService,
    CatalogToolsService,
    {
      provide: ASSISTANT_CONFIG,
      useFactory: (): AssistantConfig => ({
        enabled: process.env.ASSISTANT_ENABLED?.trim().toLowerCase() !== 'false',
        dailyTokens: positiveInt(process.env.ASSISTANT_DAILY_TOKENS),
        rateLimitPerMinute: positiveInt(process.env.ASSISTANT_RATE_LIMIT_PER_MINUTE),
        rateLimitPerDay: positiveInt(process.env.ASSISTANT_RATE_LIMIT_PER_DAY),
        allowedOrigins: origins(process.env.CORS_ORIGINS),
        maxAnswerTokens: 500,
      }),
    },
    {
      provide: ASSISTANT_KV,
      useFactory: (): KeyValueStore => {
        const url = process.env.REDIS_URL?.trim();
        return url ? new RedisKeyValueStore(url) : new InMemoryKeyValueStore();
      },
    },
    {
      provide: LLM_CLIENT,
      useFactory: (): LlmClient | null => {
        // Offline stand-in for the CI end-to-end run and demos without a key (GH#82).
        if (process.env.ASSISTANT_LLM?.trim() === 'scripted') return new ScriptedLlmClient();
        const key = process.env.OPENAI_API_KEY?.trim();
        return key
          ? new OpenAiLlmClient(key, process.env.OPENAI_CHAT_MODEL?.trim() || 'gpt-6-luna')
          : null;
      },
    },
  ],
})
export class AssistantModule implements OnApplicationShutdown {
  constructor(@Inject(ASSISTANT_KV) private readonly kv: KeyValueStore) {}

  async onApplicationShutdown(): Promise<void> {
    if (this.kv instanceof RedisKeyValueStore) await this.kv.close();
  }
}
