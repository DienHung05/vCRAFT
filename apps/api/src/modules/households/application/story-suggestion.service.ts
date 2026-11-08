import { MikroORM } from '@mikro-orm/core';
import { Inject, Injectable } from '@nestjs/common';
import type { StorySuggestionDto } from '@vcraft/contracts';
import { Household } from '@vcraft/database';
import { effectiveCraftCategory, storyPlainText } from '@vcraft/domain';
import type { Actor } from '../../../common/auth/auth.guard';
import { AppError, notFound } from '../../../common/errors/app-error';
import { LLM_CLIENT, type LlmClient } from '../../assistant/infrastructure/llm-client';
import { ScriptedLlmClient } from '../../assistant/infrastructure/scripted-llm-client';

const VI_MARK = '[[VI]]';
const EN_MARK = '[[EN]]';
/** Reasoning models spend part of the budget on hidden reasoning, so the cap is generous. */
const MAX_TOKENS = 1_600;
/** Per account: the model is a paid service, and a household rarely needs more than a few drafts an hour. */
const MAX_PER_HOUR = 10;
const HOUR_MS = 60 * 60 * 1000;

const CRAFT_LABEL = {
  GOM_SU: 'ceramics and porcelain',
  MEN: 'glazes',
  VE_GOM: 'hand-painted ceramics',
  NUNG: 'kiln firing',
  KHAC: 'other pottery craft',
} as const;

const SYSTEM_PROMPT = [
  'You help a Vietnamese pottery household (Bát Tràng) write the story shown on its public page.',
  'Write a warm, plain, honest story of 120 to 220 words in Vietnamese, then the same story in English.',
  'Use ONLY the facts given below. Never invent years, awards, names, places or numbers. If facts are few, write less.',
  'You may use **bold**, *italic* and "- " bullet lists; no headings, no HTML, no links.',
  `Answer in exactly this format: ${VI_MARK} on its own line, the Vietnamese story, then ${EN_MARK} on its own line, the English story.`,
].join('\n');

/**
 * FR-ART-08 (Could): a suggested household story and its English translation, from the profile facts. It
 * reuses the Fox assistant's chat model; the answer is only returned, never saved or published.
 */
@Injectable()
export class StorySuggestionService {
  private readonly recent = new Map<string, number[]>();

  constructor(
    private readonly orm: MikroORM,
    @Inject(LLM_CLIENT) private readonly llm: LlmClient | null,
  ) {}

  /** Whether a real chat model is configured; the offline stand-in cannot write a story. */
  private get model(): LlmClient | null {
    return this.llm && !(this.llm instanceof ScriptedLlmClient) ? this.llm : null;
  }

  async suggest(actor: Actor): Promise<StorySuggestionDto> {
    const model = this.model;
    if (!model) {
      throw new AppError('SERVICE_UNAVAILABLE', 'the story assistant is not configured');
    }
    if (actor.locked) throw new AppError('HOUSEHOLD_ACCOUNT_LOCKED');
    const household = await this.orm.em.fork().findOne(Household, { representative: actor.id });
    if (!household) throw notFound('this account does not represent a household');
    this.consumeQuota(actor.id);

    let text = '';
    for await (const chunk of model.stream(
      [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: factsOf(household) },
      ],
      { maxTokens: MAX_TOKENS, signal: AbortSignal.timeout(45_000) },
    )) {
      if (chunk.type === 'text') text += chunk.text;
    }
    const suggestion = parseSuggestion(text);
    if (!suggestion)
      throw new AppError('SERVICE_UNAVAILABLE', 'the story assistant gave no usable answer');
    return suggestion;
  }

  private consumeQuota(accountId: string): void {
    const now = Date.now();
    const used = (this.recent.get(accountId) ?? []).filter((at) => now - at < HOUR_MS);
    if (used.length >= MAX_PER_HOUR) throw new AppError('RATE_LIMITED');
    this.recent.set(accountId, [...used, now]);
  }
}

/** The household's own facts as plain lines for the model. */
function factsOf(h: Household): string {
  const category = effectiveCraftCategory(h.craftCategory, h.craft);
  const lines = [
    `Household: ${h.name}`,
    h.village ? `Village: ${h.village}` : '',
    category ? `Craft: ${CRAFT_LABEL[category]}${h.craft ? ` (${h.craft})` : ''}` : '',
    h.foundedYear ? `Founded: ${h.foundedYear}` : '',
    h.generations ? `Generations in the craft: ${h.generations}` : '',
    ...(h.timeline ?? []).map(
      (e) => `Milestone ${e.year}: ${e.title}${e.text ? `. ${e.text}` : ''}`,
    ),
    ...(h.certifications ?? []).map((c) => `Certification: ${c.name} (${c.issuer}, ${c.year})`),
    h.history.trim() ? `Current draft story:\n${storyPlainText(h.history).slice(0, 2_000)}` : '',
  ];
  return lines.filter(Boolean).join('\n');
}

/** Splits the answer at the two markers; both parts must be present. */
export function parseSuggestion(text: string): StorySuggestionDto | null {
  const vi = text.indexOf(VI_MARK);
  const en = text.indexOf(EN_MARK);
  if (vi < 0 || en < vi) return null;
  const viText = text.slice(vi + VI_MARK.length, en).trim();
  const enText = text.slice(en + EN_MARK.length).trim();
  return viText && enText ? { vi: viText.slice(0, 10_000), en: enText.slice(0, 10_000) } : null;
}
