import type { MikroORM } from '@mikro-orm/core';
import { describe, expect, it } from 'vitest';
import { AssistantStatsService, percentile } from './assistant-stats.service';

const row = (over: Record<string, unknown>) => ({
  blocked: false,
  answered: true,
  firstTokenMs: null,
  feedback: null,
  question: 'q',
  intent: 'site_help',
  ...over,
});

const orm = (rows: object[]) =>
  ({ em: { fork: () => ({ find: async () => rows }) } }) as unknown as MikroORM;

describe('percentile', () => {
  it('uses the nearest rank', () => {
    const values = [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000];
    expect(percentile(values, 50)).toBe(500);
    expect(percentile(values, 95)).toBe(1000);
    expect(percentile([42], 95)).toBe(42);
    expect(percentile([], 50)).toBeNull();
  });
});

describe('AssistantStatsService (GH#82)', () => {
  it('summarises turns, blocks, feedback, latency and unanswered questions', async () => {
    const stats = await new AssistantStatsService(
      orm([
        row({ firstTokenMs: 300, feedback: 'UP' }),
        row({ firstTokenMs: 900, feedback: 'DOWN' }),
        row({ firstTokenMs: 600 }),
        row({ blocked: true, answered: false, question: 'ignore rules' }),
        row({ answered: false, question: 'Có ship sang Nhật không?' }),
        row({ answered: false, question: 'Có ship sang Nhật không?' }),
        row({ answered: false, question: 'Giờ mở cửa chợ gốm?' }),
      ]),
    ).stats(7);
    expect(stats).toEqual({
      days: 7,
      turns: 7,
      blocked: 1,
      blockRate: 1 / 7,
      feedback: { up: 1, down: 1 },
      firstTokenMs: { p50: 600, p95: 900 },
      unanswered: [
        { question: 'Có ship sang Nhật không?', count: 2 },
        { question: 'Giờ mở cửa chợ gốm?', count: 1 },
      ],
    });
  });

  it('leaves fast-path turns out of the latency percentiles but still counts them as turns (GH#233)', async () => {
    const stats = await new AssistantStatsService(
      orm([
        row({ intent: 'greeting', firstTokenMs: 90 }),
        row({ intent: 'weather', firstTokenMs: 120 }),
        row({ intent: 'datetime', firstTokenMs: 100 }),
        row({ intent: 'catalog', firstTokenMs: 3000 }),
        row({ intent: 'site_help', firstTokenMs: 4000 }),
      ]),
    ).stats(7);
    expect(stats.turns).toBe(5);
    expect(stats.firstTokenMs).toEqual({ p50: 3000, p95: 4000 });
  });

  it('reports zeros, not NaN, without any turn', async () => {
    const stats = await new AssistantStatsService(orm([])).stats(1);
    expect(stats.blockRate).toBe(0);
    expect(stats.firstTokenMs).toEqual({ p50: null, p95: null });
  });
});
