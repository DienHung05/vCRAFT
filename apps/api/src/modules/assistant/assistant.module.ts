import { Inject, Module, type OnApplicationShutdown } from '@nestjs/common';
import {
  ASSISTANT_CONFIG,
  AskAssistantService,
  type AssistantConfig,
} from './application/ask-assistant.service';
import { CatalogToolsService } from './application/catalog-tools.service';
import { AssistantController } from './assistant.controller';
import {
  ASSISTANT_KV,
  InMemoryKeyValueStore,
  type KeyValueStore,
  RedisKeyValueStore,
} from './infrastructure/key-value';
import { LLM_CLIENT, type LlmClient } from './infrastructure/llm-client';
import { OpenAiLlmClient } from './infrastructure/openai-llm-client';

const origins = (raw = '') =>
  raw
    .split(',')
    .map((origin) => origin.trim().replace(/\/+$/, ''))
    .filter(Boolean);

/**
 * The Fox assistant (PLAN E15, ADR-19). Settings come from the environment:
 * `ASSISTANT_ENABLED=false` turns it off, `OPENAI_API_KEY` + `OPENAI_CHAT_MODEL` pick the model (without a
 * key only greetings, date and weather are answered), `REDIS_URL` holds rate limits and the token budget
 * (in memory without it), `ASSISTANT_DAILY_TOKENS` caps the spend per day.
 */
@Module({
  controllers: [AssistantController],
  providers: [
    AskAssistantService,
    CatalogToolsService,
    {
      provide: ASSISTANT_CONFIG,
      useFactory: (): AssistantConfig => ({
        enabled: process.env.ASSISTANT_ENABLED?.trim().toLowerCase() !== 'false',
        dailyTokens: Number(process.env.ASSISTANT_DAILY_TOKENS) || 2_000_000,
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
