import { MikroORM, type Options } from '@mikro-orm/core';
import { Module } from '@nestjs/common';
import { createFieldCipher, createMikroOrmOptions } from '@vcraft/database';
import { createObjectStorage } from '@vcraft/storage';
import { OBJECT_STORAGE, WorkerService } from './worker.service';

@Module({
  providers: [
    {
      provide: MikroORM,
      useFactory: () => MikroORM.init(createMikroOrmOptions() as unknown as Options),
    },
    { provide: OBJECT_STORAGE, useFactory: () => createObjectStorage() },
    // Fail fast on a missing or malformed FIELD_ENCRYPTION_KEYS (NFR-SEC-03): the worker shares the keys with
    // the API, and a deploy that lost them must not start quietly. The worker never reads encrypted fields itself.
    {
      provide: 'FIELD_ENCRYPTION_CHECK',
      useFactory: () => createFieldCipher(process.env).currentKeyId,
    },
    WorkerService,
  ],
})
export class WorkerModule {}
