import type { EntityManager } from '@mikro-orm/core';
import { Seeder } from '@mikro-orm/seeder';
import { DemoSeeder } from './DemoSeeder.js';

/**
 * Seeder gốc, dùng chung cho mọi driver (viết bằng entity, không SQL tay).
 * Mỗi nhóm dữ liệu là một seeder con gọi bằng `this.call(em, [...])`; hiện có dữ liệu mẫu demo (GH#14).
 */
export class DatabaseSeeder extends Seeder {
  async run(em: EntityManager): Promise<void> {
    await this.call(em, [DemoSeeder]);
  }
}
