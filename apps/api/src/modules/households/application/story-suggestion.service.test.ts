import type { MikroORM } from '@mikro-orm/core';
import { describe, expect, it, vi } from 'vitest';
import type { Actor } from '../../../common/auth/auth.guard';
import { AppError } from '../../../common/errors/app-error';
import type { LlmChunk, LlmClient } from '../../assistant/infrastructure/llm-client';
import { ScriptedLlmClient } from '../../assistant/infrastructure/scripted-llm-client';
import { parseSuggestion, StorySuggestionService } from './story-suggestion.service';

const actor = { id: 'u1', role: 'HOUSEHOLD', locked: false } as unknown as Actor;
const household = {
  name: 'Gốm Mai',
  village: 'Bát Tràng',
  craft: 'men lam',
  craftCategory: null,
  foundedYear: 1962,
  generations: 3,
  timeline: [{ year: 1962, title: 'Đỏ lửa', text: '' }],
  certifications: [],
  history: 'Nhà làm gốm **ba đời**.',
};
const orm = { em: { fork: () => ({ findOne: async () => household }) } } as unknown as MikroORM;

function llm(text: string): LlmClient & { prompts: unknown[] } {
  const prompts: unknown[] = [];
  return {
    prompts,
    classify: vi.fn(),
    async *stream(messages): AsyncIterable<LlmChunk> {
      prompts.push(messages);
      yield { type: 'text', text };
      yield { type: 'usage', tokens: 5 };
    },
  } as LlmClient & { prompts: unknown[] };
}

describe('StorySuggestionService (FR-ART-08)', () => {
  it('answers 503 when no chat model is configured, or only the offline stand-in', async () => {
    for (const client of [null, new ScriptedLlmClient()]) {
      const error = await new StorySuggestionService(orm, client).suggest(actor).catch((e) => e);
      expect(error).toBeInstanceOf(AppError);
      expect(error.code).toBe('SERVICE_UNAVAILABLE');
    }
  });

  it('returns the Vietnamese story and its English translation, built from the profile facts', async () => {
    const client = llm('[[VI]]\nGốm ba đời.\n[[EN]]\nThree generations of pottery.');
    const result = await new StorySuggestionService(orm, client).suggest(actor);
    expect(result).toEqual({ vi: 'Gốm ba đời.', en: 'Three generations of pottery.' });
    const prompt = JSON.stringify(client.prompts[0]);
    expect(prompt).toContain('Gốm Mai');
    expect(prompt).toContain('Founded: 1962');
    expect(prompt).toContain('Milestone 1962: Đỏ lửa');
    // The current draft is passed as plain text, without its markup.
    expect(prompt).toContain('Nhà làm gốm ba đời.');
  });

  it('refuses an answer that is missing one of the two languages', async () => {
    const error = await new StorySuggestionService(orm, llm('Just text'))
      .suggest(actor)
      .catch((e) => e);
    expect(error.code).toBe('SERVICE_UNAVAILABLE');
    expect(parseSuggestion('[[VI]]\nx\n[[EN]]\n')).toBeNull();
  });

  it('limits how many suggestions one account can ask for per hour', async () => {
    const service = new StorySuggestionService(orm, llm('[[VI]]\na\n[[EN]]\nb'));
    for (let i = 0; i < 10; i++) await service.suggest(actor);
    const error = await service.suggest(actor).catch((e) => e);
    expect(error.code).toBe('RATE_LIMITED');
  });

  it('refuses a locked account', async () => {
    const error = await new StorySuggestionService(orm, llm('x'))
      .suggest({ ...actor, locked: true })
      .catch((e) => e);
    expect(error.code).toBe('HOUSEHOLD_ACCOUNT_LOCKED');
  });
});
