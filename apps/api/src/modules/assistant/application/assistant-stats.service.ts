import { MikroORM, raw } from '@mikro-orm/core';
import { Injectable } from '@nestjs/common';
import type { AssistantStatsDto } from '@vcraft/contracts';
import { AssistantMessageLog } from '@vcraft/database';
import { FAST_INTENTS } from './fast-intents';

/** Nearest-rank percentile of sorted values; null for an empty list. */
export function percentile(sorted: readonly number[], p: number): number | null {
  if (sorted.length === 0) return null;
  const rank = Math.ceil((p / 100) * sorted.length);
  return sorted[Math.min(sorted.length, Math.max(1, rank)) - 1] ?? null;
}

// Refusals by the guardrail and classifier layers: the only turns that count as attacks.
const GUARDRAIL_REASONS = ['INJECTION', 'ABUSE', 'PRIVATE_DATA'];
// Limits (per-IP rate limit, daily token budget) and the kill switch are not attacks.
const LIMIT_REASONS = ['RATE_LIMITED', 'BUDGET_EXHAUSTED'];
// Not-blocked turns that ended in an error event (model down or too slow) carry one of these in `blockReason`.
const FAILURE_REASONS = ['UPSTREAM', 'TIMEOUT'];

/**
 * The slice of MikroORM's SQL QueryBuilder used here. `@mikro-orm/sql` is not a dependency of the API (the
 * driver comes through `@vcraft/database`), so the builder the SQL entity manager hands out is typed by hand.
 */
interface StatsQuery {
  select(fields: unknown): StatsQuery;
  where(condition: object): StatsQuery;
  groupBy(fields: string[]): StatsQuery;
  orderBy(order: object | object[]): StatsQuery;
  offset(count: number): StatsQuery;
  limit(count: number): StatsQuery;
  execute(method: 'all' | 'get'): Promise<unknown>;
}

interface TurnGroup {
  blocked: boolean;
  blockReason: string | null;
  answered: boolean;
  intent: string;
  total: number | string;
}

/**
 * The Assistant card on the admin dashboard (FR-AST-08, GH#82): turns, guardrail blocks, limits, failures,
 * thumbs up/down and first-token latency (model turns only), over the last few days. Reads the anonymous log
 * only, which holds at most 30 days. Everything is aggregated in SQL.
 */
@Injectable()
export class AssistantStatsService {
  constructor(private readonly orm: MikroORM) {}

  async stats(days: number, now = new Date()): Promise<AssistantStatsDto> {
    const since = new Date(now.getTime() - days * 86_400_000);
    const em = this.orm.em.fork();
    const sqlEm = em as unknown as {
      createQueryBuilder(entity: typeof AssistantMessageLog, alias: string): StatsQuery;
    };
    const inWindow = () => sqlEm.createQueryBuilder(AssistantMessageLog, 'l');

    const groups = (await inWindow()
      .select(['blocked', 'blockReason', 'answered', 'intent', raw('count(*) as total')])
      .where({ createdAt: { $gte: since } })
      .groupBy(['blocked', 'blockReason', 'answered', 'intent'])
      .execute('all')) as unknown as TurnGroup[];

    const counts = { turns: 0, blocked: 0, limited: 0, disabled: 0, failures: 0 };
    for (const g of groups) {
      const n = Number(g.total);
      const reason = g.blockReason ?? '';
      counts.turns += n;
      if (g.blocked) {
        if (GUARDRAIL_REASONS.includes(reason)) counts.blocked += n;
        else if (LIMIT_REASONS.includes(reason)) counts.limited += n;
        else if (reason === 'DISABLED') counts.disabled += n;
      } else if (!g.answered) {
        // Rows from before failures were tagged: a classifier outage was logged as intent `unknown`.
        if (FAILURE_REASONS.includes(reason) || g.intent === 'unknown') counts.failures += n;
      }
    }

    const feedbackRows = (await inWindow()
      .select(['feedback', raw('count(*) as total')])
      .where({ createdAt: { $gte: since }, feedback: { $ne: null } })
      .groupBy(['feedback'])
      .execute('all')) as unknown as { feedback: string; total: number | string }[];
    const feedback = (rating: 'UP' | 'DOWN') =>
      Number(feedbackRows.find((r) => r.feedback === rating)?.total ?? 0);

    // Fast-path turns never reach the model; mixing their ~100 ms in would hide the real first-token latency.
    const latencyWhere = {
      createdAt: { $gte: since },
      firstTokenMs: { $ne: null },
      intent: { $nin: [...FAST_INTENTS] },
    };
    const latencyCount = Number(
      (
        (await inWindow().select(raw('count(*) as total')).where(latencyWhere).execute('get')) as
          | { total: number | string }
          | undefined
      )?.total ?? 0,
    );
    // Nearest-rank percentile, as `percentile` does, read as a single row at the right offset.
    const atRank = async (p: number): Promise<number | null> => {
      if (latencyCount === 0) return null;
      const rank = Math.min(latencyCount, Math.max(1, Math.ceil((p / 100) * latencyCount)));
      const row = (await inWindow()
        .select('firstTokenMs')
        .where(latencyWhere)
        .orderBy({ firstTokenMs: 'asc' })
        .offset(rank - 1)
        .limit(1)
        .execute('get')) as { firstTokenMs: number | string } | undefined;
      return row ? Number(row.firstTokenMs) : null;
    };

    return {
      days,
      turns: counts.turns,
      blocked: counts.blocked,
      blockRate: counts.turns ? counts.blocked / counts.turns : 0,
      limited: counts.limited,
      disabled: counts.disabled,
      failures: counts.failures,
      feedback: { up: feedback('UP'), down: feedback('DOWN') },
      firstTokenMs: { p50: await atRank(50), p95: await atRank(95) },
    };
  }
}
