import type { AssistantEvent } from '@vcraft/contracts';
import { describe, expect, it, vi } from 'vitest';
import { sseLines } from './assistant.controller';

async function collect(lines: AsyncIterable<string>): Promise<string[]> {
  const out: string[] = [];
  for await (const line of lines) out.push(line);
  return out;
}

async function* failingTurn(): AsyncGenerator<AssistantEvent> {
  yield { type: 'thinking' };
  throw new Error('connect ECONNREFUSED redis');
}

describe('assistant SSE stream (GH#147)', () => {
  it('writes each event as one data line', async () => {
    async function* turn(): AsyncGenerator<AssistantEvent> {
      yield { type: 'thinking' };
      yield { type: 'delta', text: 'Chào bạn' };
    }
    const logger = { error: vi.fn() };
    expect(await collect(sseLines(turn(), new AbortController().signal, logger))).toEqual([
      'data: {"type":"thinking"}\n\n',
      'data: {"type":"delta","text":"Chào bạn"}\n\n',
    ]);
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('logs a failed turn and ends with an INTERNAL error event', async () => {
    const logger = { error: vi.fn() };
    const lines = await collect(sseLines(failingTurn(), new AbortController().signal, logger));
    expect(lines).toEqual([
      'data: {"type":"thinking"}\n\n',
      'data: {"type":"error","code":"INTERNAL"}\n\n',
    ]);
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('ECONNREFUSED redis'),
      expect.stringContaining('Error: connect ECONNREFUSED redis'),
    );
  });

  it('stays quiet when the client went away', async () => {
    const aborted = new AbortController();
    aborted.abort();
    const logger = { error: vi.fn() };
    expect(await collect(sseLines(failingTurn(), aborted.signal, logger))).toEqual([
      'data: {"type":"thinking"}\n\n',
    ]);
    expect(logger.error).not.toHaveBeenCalled();
  });
});
