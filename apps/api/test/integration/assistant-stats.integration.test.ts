import { AssistantMessageLog } from '@vcraft/database';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startTestApp, type TestApp } from './support/test-app.js';
import { startTestDatabase, type TestDatabase } from './support/test-database.js';

type Seed = Partial<{
  intent: string;
  blocked: boolean;
  blockReason: string | null;
  answered: boolean;
  question: string;
  firstTokenMs: number | null;
  feedback: 'UP' | 'DOWN' | null;
  createdAt: Date;
}>;

/** GH#410: the admin Assistant card separates guardrail blocks, limits, failures and unanswered questions, in SQL. */
describe('Assistant stats categories', () => {
  let db: TestDatabase;
  let t: TestApp;

  const seed = async (rows: Seed[]) => {
    const em = db.orm.em.fork();
    for (const r of rows) {
      em.create(AssistantMessageLog, {
        ipHash: 'a'.repeat(64),
        locale: 'vi',
        question: 'q',
        intent: 'site_help',
        tokens: 0,
        ...r,
      });
    }
    await em.flush();
  };

  beforeAll(async () => {
    db = await startTestDatabase();
    await db.migrate();
    t = await startTestApp(db);
  }, 240_000);

  afterAll(async () => {
    await t?.close();
    await db?.stop();
  });

  it('counts each outcome in its own bucket', async () => {
    const blocked = (blockReason: string) => ({
      blocked: true,
      blockReason,
      answered: false,
      intent: 'x',
    });
    await seed([
      // answered turns, two on the model path (latency 300, 900) and one fast-path
      { firstTokenMs: 300, feedback: 'UP' },
      { firstTokenMs: 900, feedback: 'DOWN' },
      { intent: 'greeting', firstTokenMs: 50 },
      // guardrail blocks
      blocked('INJECTION'),
      blocked('ABUSE'),
      blocked('PRIVATE_DATA'),
      // limits and the kill switch are not attacks
      blocked('RATE_LIMITED'),
      blocked('BUDGET_EXHAUSTED'),
      blocked('DISABLED'),
      // failures
      { intent: 'unknown', blockReason: 'UPSTREAM', answered: false, question: 'down' },
      { blockReason: 'TIMEOUT', answered: false, question: 'slow' },
      { intent: 'unknown', answered: false, question: 'legacy outage row' },
      // unanswered
      { answered: false, question: 'Có ship sang Nhật không?' },
      { answered: false, question: 'Có ship sang Nhật không?' },
      { answered: false, question: 'Giờ mở cửa chợ gốm?' },
      // outside the window
      {
        blocked: true,
        blockReason: 'INJECTION',
        createdAt: new Date(Date.now() - 20 * 86_400_000),
      },
    ]);
    const admin = await t.createUser('ADMIN');
    const res = await t.request({
      method: 'GET',
      url: '/admin/assistant/stats?days=7',
      auth: admin.auth,
    });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      days: 7,
      turns: 15,
      blocked: 3,
      blockRate: 3 / 15,
      limited: 2,
      disabled: 1,
      failures: 3,
      unansweredCount: 3,
      feedback: { up: 1, down: 1 },
      firstTokenMs: { p50: 300, p95: 900 },
      unanswered: [
        { question: 'Có ship sang Nhật không?', count: 2 },
        { question: 'Giờ mở cửa chợ gốm?', count: 1 },
      ],
    });
  });
});
