import { MikroORM } from '@mikro-orm/core';
import {
  Inject,
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from '@nestjs/common';
import { notifyDueImportantNews } from '@vcraft/database';
import type { ObjectStorage } from '@vcraft/storage';
import { type ConnectionOptions, Queue, Worker } from 'bullmq';
import { createTransport } from 'nodemailer';
import {
  type AssistantIngestJob,
  ingestSource,
  knowledgeFromEnv,
} from './processors/assistant/ingest';
import { createNoticeLoader } from './processors/mail/load-notice';
import { type HouseholdMailJob, sendHouseholdMail } from './processors/mail/send-household-mail';
import { sendNoticeMail } from './processors/mail/send-notice-mail';
import { processMediaAsset } from './processors/media/process-media';
import { createOutboxDispatcher } from './processors/outbox/dispatch';
import { relayOutbox } from './processors/outbox/relay-outbox';
import { generateQrLabels, type QrLabelsJob } from './processors/qr-labels/generate-qr-labels';
import {
  ASSISTANT_LOG_PURGE_EVERY_MS,
  ASSISTANT_LOG_PURGE_JOB,
  COORDINATION_CHECK_EVERY_MS,
  IDEMPOTENCY_PURGE_EVERY_MS,
  IDEMPOTENCY_PURGE_JOB,
  PAYMENT_EXPIRE_EVERY_MS,
  PAYMENT_EXPIRE_SWEEP_JOB,
  RFQ_COORDINATION_CHECK_JOB,
  RFQ_EXPIRE_SWEEP_JOB,
  RFQ_SWEEP_EVERY_MS,
  runSchedulerJob,
} from './processors/scheduler/rfq-jobs';
import { DEFAULT_JOB_OPTIONS, OUTBOX_JOB_OPTIONS, trimFinishedJobs } from './queue-retention';
import {
  ASSISTANT_QUEUE,
  MAIL_QUEUE,
  type MailJob,
  MEDIA_QUEUE,
  type MediaJob,
  OUTBOX_QUEUE,
  OUTBOX_RELAY_EVERY_MS,
  QR_LABELS_QUEUE,
  SCHEDULER_QUEUE,
} from './queues';

export const OBJECT_STORAGE = Symbol('OBJECT_STORAGE');

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
    const qrLabels = new Queue<QrLabelsJob>(QR_LABELS_QUEUE, {
      connection,
      defaultJobOptions: DEFAULT_JOB_OPTIONS,
    });
    const scheduler = new Queue(SCHEDULER_QUEUE, {
      connection,
      defaultJobOptions: DEFAULT_JOB_OPTIONS,
    });
    const assistant = new Queue<AssistantIngestJob>(ASSISTANT_QUEUE, {
      connection,
      defaultJobOptions: DEFAULT_JOB_OPTIONS,
    });
    const knowledge = { orm: this.orm, ...knowledgeFromEnv() };
    const outbox = new Queue(OUTBOX_QUEUE, { connection, defaultJobOptions: OUTBOX_JOB_OPTIONS });
    // Free space first: a full Redis refuses the writes below (issue #153).
    await trimFinishedJobs([media, mail, qrLabels, scheduler, assistant, outbox], this.logger);
    const dispatch = createOutboxDispatcher({ media, mail, qrLabels, scheduler, assistant });
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
      new Worker<QrLabelsJob>(
        QR_LABELS_QUEUE,
        (job) =>
          generateQrLabels(
            {
              storage: this.storage,
              // The labels must encode the public site, as the web's own QR does (`traceShortUrl`).
              origin: process.env.NEXT_PUBLIC_SITE_URL ?? mailDeps.appUrl,
            },
            job.data,
          ),
        { connection, concurrency: 1 },
      ),
      new Worker<AssistantIngestJob>(ASSISTANT_QUEUE, (job) => ingestSource(knowledge, job.data), {
        connection,
        concurrency: 1,
      }),
      new Worker(SCHEDULER_QUEUE, (job) => runSchedulerJob(this.orm, job.name, job.data), {
        connection,
        concurrency: 1,
      }),
      new Worker(
        OUTBOX_QUEUE,
        async () => {
          await notifyDueImportantNews(this.orm);
          return relayOutbox(this.orm, dispatch);
        },
        { connection },
      ),
    ];
    for (const worker of workers)
      worker.on('failed', (job, error) =>
        this.logger.warn(`${worker.name} job ${job?.id} failed: ${error.message}`),
      );
    await outbox.upsertJobScheduler('relay', { every: OUTBOX_RELAY_EVERY_MS });
    await scheduler.upsertJobScheduler(
      RFQ_EXPIRE_SWEEP_JOB,
      { every: RFQ_SWEEP_EVERY_MS },
      { name: RFQ_EXPIRE_SWEEP_JOB },
    );
    await scheduler.upsertJobScheduler(
      RFQ_COORDINATION_CHECK_JOB,
      { every: COORDINATION_CHECK_EVERY_MS },
      { name: RFQ_COORDINATION_CHECK_JOB },
    );
    await scheduler.upsertJobScheduler(
      ASSISTANT_LOG_PURGE_JOB,
      { every: ASSISTANT_LOG_PURGE_EVERY_MS },
      { name: ASSISTANT_LOG_PURGE_JOB },
    );
    await scheduler.upsertJobScheduler(
      IDEMPOTENCY_PURGE_JOB,
      { every: IDEMPOTENCY_PURGE_EVERY_MS },
      { name: IDEMPOTENCY_PURGE_JOB },
    );
    await scheduler.upsertJobScheduler(
      PAYMENT_EXPIRE_SWEEP_JOB,
      { every: PAYMENT_EXPIRE_EVERY_MS },
      { name: PAYMENT_EXPIRE_SWEEP_JOB },
    );
    this.closables.push(...workers, media, mail, qrLabels, scheduler, assistant, outbox, {
      close: async () => mailDeps.transport.close(),
    });
    this.logger.log('queues ready: media, mail, qr-labels, scheduler, assistant, outbox');
  }

  async onApplicationShutdown(): Promise<void> {
    await Promise.all(this.closables.map((closable) => closable.close()));
    await this.orm.close();
  }
}
