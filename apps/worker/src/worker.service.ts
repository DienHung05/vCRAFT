import { MikroORM } from '@mikro-orm/core';
import {
  Inject,
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from '@nestjs/common';
import type { ObjectStorage } from '@vcraft/storage';
import { type ConnectionOptions, Queue, Worker } from 'bullmq';
import { createTransport } from 'nodemailer';
import { createNoticeLoader } from './processors/mail/load-notice';
import { type HouseholdMailJob, sendHouseholdMail } from './processors/mail/send-household-mail';
import { sendNoticeMail } from './processors/mail/send-notice-mail';
import { processMediaAsset } from './processors/media/process-media';
import { createOutboxDispatcher } from './processors/outbox/dispatch';
import { relayOutbox } from './processors/outbox/relay-outbox';
import {
  MAIL_QUEUE,
  type MailJob,
  MEDIA_QUEUE,
  type MediaJob,
  OUTBOX_QUEUE,
  OUTBOX_RELAY_EVERY_MS,
} from './queues';

export const OBJECT_STORAGE = Symbol('OBJECT_STORAGE');

const DEFAULT_JOB_OPTIONS = {
  attempts: 3,
  backoff: { type: 'exponential', delay: 5_000 },
  removeOnComplete: 1_000,
  removeOnFail: 5_000,
} as const;

function redisConnection(): ConnectionOptions {
  const url = new URL(process.env.REDIS_URL ?? 'redis://localhost:6379');
  return {
    host: url.hostname,
    port: Number(url.port || 6379),
    ...(url.password && { password: decodeURIComponent(url.password) }),
    ...(url.protocol === 'rediss:' && { tls: {} }),
    maxRetriesPerRequest: null,
  };
}

/** Dựng hàng đợi và worker BullMQ khi tiến trình khởi động; đóng gọn khi nhận tín hiệu dừng. */
@Injectable()
export class WorkerService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(WorkerService.name);
  private readonly closables: Array<{ close(): Promise<void> }> = [];

  constructor(
    private readonly orm: MikroORM,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const connection = redisConnection();
    const media = new Queue<MediaJob>(MEDIA_QUEUE, {
      connection,
      defaultJobOptions: DEFAULT_JOB_OPTIONS,
    });
    const mail = new Queue<MailJob>(MAIL_QUEUE, {
      connection,
      defaultJobOptions: DEFAULT_JOB_OPTIONS,
    });
    const outbox = new Queue(OUTBOX_QUEUE, { connection });
    const dispatch = createOutboxDispatcher({ media, mail });
    const mailDeps = {
      loadNotice: createNoticeLoader(this.orm),
      transport: createTransport(process.env.SMTP_URL ?? 'smtp://localhost:1025'),
      from: process.env.MAIL_FROM ?? 'vCraft <no-reply@vcraft.local>',
      appUrl: process.env.APP_URL ?? 'http://localhost:8080',
    };

    const workers = [
      new Worker<MediaJob>(
        MEDIA_QUEUE,
        (job) => processMediaAsset({ orm: this.orm, storage: this.storage }, job.data.assetId),
        { connection, concurrency: 2 },
      ),
      new Worker<MailJob | HouseholdMailJob>(
        MAIL_QUEUE,
        (job) =>
          job.name === 'household-decision'
            ? sendHouseholdMail(
                {
                  orm: this.orm,
                  transport: mailDeps.transport,
                  from: mailDeps.from,
                  appUrl: mailDeps.appUrl,
                },
                job.data as HouseholdMailJob,
              )
            : sendNoticeMail(mailDeps, (job.data as MailJob).noticeId),
        {
          connection,
          concurrency: 2,
        },
      ),
      new Worker(OUTBOX_QUEUE, () => relayOutbox(this.orm, dispatch), { connection }),
    ];
    for (const worker of workers)
      worker.on('failed', (job, error) =>
        this.logger.warn(`${worker.name} job ${job?.id} failed: ${error.message}`),
      );
    await outbox.upsertJobScheduler('relay', { every: OUTBOX_RELAY_EVERY_MS });
    this.closables.push(...workers, media, mail, outbox, {
      close: async () => mailDeps.transport.close(),
    });
    this.logger.log('queues ready: media, mail, outbox');
  }

  async onApplicationShutdown(): Promise<void> {
    await Promise.all(this.closables.map((closable) => closable.close()));
    await this.orm.close();
  }
}
