import type { EntityManager } from '@mikro-orm/core';
import { Seeder } from '@mikro-orm/seeder';

/**
 * Seeder gốc, dùng chung cho mọi driver (viết bằng entity, không SQL tay).
 * Dữ liệu mẫu được thêm ở các sprint sau, mỗi nhóm một seeder con gọi bằng `this.call(em, [...])`.
 */
export class DatabaseSeeder extends Seeder {
  async run(_em: EntityManager): Promise<void> {
    // Chưa có dữ liệu mẫu (E0).
  }
}
