import { MikroORM } from '@mikro-orm/core';
import { Injectable } from '@nestjs/common';
import type { AssistantStatsDto } from '@vcraft/contracts';
import { AssistantMessageLog } from '@vcraft/database';
import { FAST_INTENTS, type FastIntent } from './fast-intents';

/** Nearest-rank percentile of sorted values; null for an empty list. */
export function percentile(sorted: readonly number[], p: number): number | null {
  if (sorted.length === 0) return null;
  const rank = Math.ceil((p / 100) * sorted.length);
  return sorted[Math.min(sorted.length, Math.max(1, rank)) - 1] ?? null;
}

/**
 * The Assistant card on the admin dashboard (FR-AST-08, GH#82): turns, block rate, thumbs up/down,
 * first-token latency (model turns only) and the questions the Fox could not answer, over the last few days. Reads the
 * anonymous log only, which holds at most 30 days.
 */
@Injectable()
export class AssistantStatsService {
  constructor(private readonly orm: MikroORM) {}

  async stats(days: number, now = new Date()): Promise<AssistantStatsDto> {
    const since = new Date(now.getTime() - days * 86_400_000);
    const rows = await this.orm.em
      .fork()
      .find(
        AssistantMessageLog,
        { createdAt: { $gte: since } },
        { fields: ['blocked', 'answered', 'firstTokenMs', 'feedback', 'question', 'intent'] },
      );
    const blocked = rows.filter((r) => r.blocked).length;
    // Fast-path turns never reach the model; mixing their ~100 ms in would hide the real first-token latency.
    const latencies = rows
      .filter((r) => !FAST_INTENTS.includes(r.intent as FastIntent))
      .map((r) => r.firstTokenMs)
      .filter((ms): ms is number => typeof ms === 'number')
      .sort((a, b) => a - b);
    const unanswered = new Map<string, number>();
    for (const row of rows) {
      if (row.blocked || row.answered) continue;
      const key = row.question.trim();
      if (key) unanswered.set(key, (unanswered.get(key) ?? 0) + 1);
    }
    return {
      days,
      turns: rows.length,
      blocked,
      blockRate: rows.length ? blocked / rows.length : 0,
      feedback: {
        up: rows.filter((r) => r.feedback === 'UP').length,
        down: rows.filter((r) => r.feedback === 'DOWN').length,
      },
      firstTokenMs: { p50: percentile(latencies, 50), p95: percentile(latencies, 95) },
      unanswered: [...unanswered]
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .slice(0, 10)
        .map(([question, count]) => ({ question, count })),
    };
  }
}
