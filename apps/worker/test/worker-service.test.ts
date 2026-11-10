import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  queues: [] as Array<{
    name: string;
    upsertJobScheduler: ReturnType<typeof vi.fn>;
    removeJobScheduler: ReturnType<typeof vi.fn>;
    close: ReturnType<typeof vi.fn>;
  }>,
  workers: [] as Array<{ name: string; opts: { concurrency?: number } }>,
}));

vi.mock('bullmq', () => ({
  Queue: class {
    name: string;
    upsertJobScheduler = vi.fn().mockResolvedValue(undefined);
    removeJobScheduler = vi.fn().mockResolvedValue(true);
    close = vi.fn().mockResolvedValue(undefined);
    clean = vi.fn().mockResolvedValue([]);
    constructor(name: string) {
      this.name = name;
      state.queues.push(this);
    }
  },
  Worker: class {
    on = vi.fn();
    close = vi.fn().mockResolvedValue(undefined);
    constructor(
      public name: string,
      _processor: unknown,
      public opts: { concurrency?: number },
    ) {
      state.workers.push(this);
    }
  },
}));

vi.mock('nodemailer', () => ({ createTransport: () => ({ close: vi.fn() }) }));
vi.mock('@vcraft/database', () => ({
  notifyDueImportantNews: vi.fn(),
  queueNewlyLiveNews: vi.fn(),
}));

import { WorkerService } from '../src/worker.service';

const NEWS_JOB = 'news.import';

async function boot(feeds: string | undefined) {
  if (feeds === undefined) delete process.env.NEWS_IMPORT_FEEDS;
  else process.env.NEWS_IMPORT_FEEDS = feeds;
  const service = new WorkerService({ close: vi.fn() } as never, {} as never);
  await service.onApplicationBootstrap();
  const queue = (name: string) => {
    const found = state.queues.find((q) => q.name === name);
    if (!found) throw new Error(`no queue ${name}`);
    return found;
  };
  return { service, queue };
}

describe('WorkerService news import queue', () => {
  beforeEach(() => {
    state.queues.length = 0;
    state.workers.length = 0;
  });

  it('schedules news import on its own queue, not on the scheduler', async () => {
    const { queue } = await boot('https://example.com/feed.xml');
    const scheduled = (q: string) =>
      queue(q).upsertJobScheduler.mock.calls.map((call) => call[0] as string);
    expect(scheduled('news-import')).toEqual([NEWS_JOB]);
    expect(scheduled('scheduler')).not.toContain(NEWS_JOB);
    // The repeat left on the shared queue by earlier deploys is removed.
    expect(queue('scheduler').removeJobScheduler).toHaveBeenCalledWith(NEWS_JOB);
    const worker = state.workers.find((w) => w.name === 'news-import');
    expect(worker?.opts.concurrency).toBe(1);
  });

  it('removes the schedule on both queues when news import is off', async () => {
    const { queue } = await boot(undefined);
    expect(queue('news-import').upsertJobScheduler).not.toHaveBeenCalled();
    expect(queue('news-import').removeJobScheduler).toHaveBeenCalledWith(NEWS_JOB);
    expect(queue('scheduler').removeJobScheduler).toHaveBeenCalledWith(NEWS_JOB);
  });

  it('closes the news import queue and worker on shutdown', async () => {
    const { service, queue } = await boot(undefined);
    await service.onApplicationShutdown();
    expect(queue('news-import').close).toHaveBeenCalled();
  });
});
