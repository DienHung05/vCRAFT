import { describe, expect, it } from 'vitest';
import {
  ASSISTANT_HISTORY_MAX,
  ASSISTANT_MESSAGE_MAX,
  AssistantMessageRequestSchema,
} from '../src/assistant';

const base = {
  history: [],
  locale: 'vi',
  pagePath: '/vi',
  conversationId: '00000000-0000-7000-8000-00000000c0de',
};

describe('AssistantMessageRequestSchema', () => {
  it('accepts a message of the maximum length and refuses one character more', () => {
    expect(ASSISTANT_MESSAGE_MAX).toBe(4_000);
    expect(
      AssistantMessageRequestSchema.safeParse({
        ...base,
        message: 'a'.repeat(ASSISTANT_MESSAGE_MAX),
      }).success,
    ).toBe(true);
    expect(
      AssistantMessageRequestSchema.safeParse({
        ...base,
        message: 'a'.repeat(ASSISTANT_MESSAGE_MAX + 1),
      }).success,
    ).toBe(false);
  });

  it('accepts the maximum history and refuses one turn more', () => {
    expect(ASSISTANT_HISTORY_MAX).toBe(20);
    const turns = (n: number) =>
      Array.from({ length: n }, () => ({ role: 'user' as const, content: 'hi' }));
    expect(
      AssistantMessageRequestSchema.safeParse({
        ...base,
        message: 'hi',
        history: turns(ASSISTANT_HISTORY_MAX),
      }).success,
    ).toBe(true);
    expect(
      AssistantMessageRequestSchema.safeParse({
        ...base,
        message: 'hi',
        history: turns(ASSISTANT_HISTORY_MAX + 1),
      }).success,
    ).toBe(false);
  });
});
