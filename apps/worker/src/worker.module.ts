import { MikroORM, type Options } from '@mikro-orm/core';
import { Module } from '@nestjs/common';
import { createMikroOrmOptions } from '@vcraft/database';
import { createObjectStorage } from '@vcraft/storage';
import { OBJECT_STORAGE, WorkerService } from './worker.service';

@Module({
  providers: [
    {
      provide: MikroORM,
      useFactory: () => MikroORM.init(createMikroOrmOptions() as unknown as Options),
    },
    { provide: OBJECT_STORAGE, useFactory: () => createObjectStorage() },
    WorkerService,
  ],
})
export class WorkerModule {}
