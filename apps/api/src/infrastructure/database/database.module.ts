import { MikroORM, type Options } from '@mikro-orm/core';
import { Global, Inject, Module, type OnApplicationShutdown } from '@nestjs/common';
import { createMikroOrmOptions } from '@vcraft/database';
import { slowQueryOptions } from './slow-query-logger';

/**
 * Cung cấp `MikroORM` cho toàn ứng dụng. Mỗi use case tự `em.fork()` / `em.transactional()` nên không
 * phụ thuộc middleware RequestContext. Test thay provider `MikroORM` bằng ORM trỏ vào Testcontainers.
 */
@Global()
@Module({
  providers: [
    {
      provide: MikroORM,
      useFactory: () =>
        MikroORM.init(createMikroOrmOptions(process.env, slowQueryOptions()) as unknown as Options),
    },
  ],
  exports: [MikroORM],
})
export class DatabaseModule implements OnApplicationShutdown {
  constructor(@Inject(MikroORM) private readonly orm: MikroORM) {}

  async onApplicationShutdown(): Promise<void> {
    await this.orm.close();
  }
}
